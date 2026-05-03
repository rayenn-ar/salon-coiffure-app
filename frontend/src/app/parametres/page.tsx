'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Settings,
  User,
  Lock,
  Clock,
  MapPin,
  Phone,
  Mail,
  Building,
  Save,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import api from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SalonParams {
  nomSalon: string;
  slogan: string;
  adresse: string;
  ville: string;
  telephone: string;
  emailContact: string;
  description: string;
  googleMapsUrl: string;
  dureeSlotMin: number;
  avanceMaxJours: number;
  delaiAnnulationH: number;
  horaireOuverture: Record<string, { ouvert: boolean; debut: string; fin: string }>;
}

interface ProfilData {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  bio?: string;
  specialites?: string;
  niveau?: string;
}

const JOURS = [
  { key: 'lundi', label: 'Lundi' },
  { key: 'mardi', label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
  { key: 'samedi', label: 'Samedi' },
  { key: 'dimanche', label: 'Dimanche' },
];

const JOURS_SEMAINE_NUM: Record<string, number> = {
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
};

const DEFAULT_HORAIRES = Object.fromEntries(
  JOURS.map((j) => [j.key, { ouvert: j.key !== 'dimanche', debut: '09:00', fin: '19:00' }])
);

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <Icon className="h-4 w-4 text-purple-600" />
          </div>
          <span className="font-semibold text-gray-900">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6 pt-2">{children}</div>}
    </div>
  );
}

// ─── Save button ──────────────────────────────────────────────────────────────

function SaveBar({
  onSave,
  loading,
  ok,
  err,
}: {
  onSave: () => void;
  loading: boolean;
  ok: string | null;
  err: string | null;
}) {
  return (
    <div className="flex items-center gap-4 mt-2">
      <button
        onClick={onSave}
        disabled={loading}
        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {loading ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      {ok && (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" /> {ok}
        </span>
      )}
      {err && <span className="text-sm text-red-500">{err}</span>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ParametresContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceChange = searchParams.get('forceChange') === '1';
  const { user, token, _hasHydrated } = useAuthStore();
  const role = user?.role;

  // ── Salon params (ADMIN only) ──────────────────────────────────────────────
  const [salon, setSalon] = useState<SalonParams>({
    nomSalon: '', slogan: '', adresse: '', ville: '', telephone: '',
    emailContact: '', description: '', googleMapsUrl: '', dureeSlotMin: 30, avanceMaxJours: 60,
    delaiAnnulationH: 24,
    horaireOuverture: DEFAULT_HORAIRES,
  });
  const [salonLoading, setSalonLoading] = useState(false);
  const [salonOk, setSalonOk] = useState<string | null>(null);
  const [salonErr, setSalonErr] = useState<string | null>(null);

  // ── Profil ─────────────────────────────────────────────────────────────────
  const [profil, setProfil] = useState<ProfilData>({
    nom: '', prenom: '', telephone: '', email: '', bio: '', specialites: '', niveau: '',
  });
  const [profilLoading, setProfilLoading] = useState(false);
  const [profilOk, setProfilOk] = useState<string | null>(null);
  const [profilErr, setProfilErr] = useState<string | null>(null);

  // ── Disponibilités (COIFFEUSE only) ───────────────────────────────────────
  const [dispos, setDispos] = useState<Record<string, { ouvert: boolean; debut: string; fin: string }>>(DEFAULT_HORAIRES);
  const [dispoLoading, setDispoLoading] = useState(false);
  const [dispoOk, setDispoOk] = useState<string | null>(null);
  const [dispoErr, setDispoErr] = useState<string | null>(null);

  // ── Password ───────────────────────────────────────────────────────────────
  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [confirmMdp, setConfirmMdp] = useState('');
  const [mdpLoading, setMdpLoading] = useState(false);
  const [mdpOk, setMdpOk] = useState<string | null>(null);
  const [mdpErr, setMdpErr] = useState<string | null>(null);
  const [showAncienMdp, setShowAncienMdp] = useState(false);
  const [showNouveauMdp, setShowNouveauMdp] = useState(false);
  const [showConfirmMdp, setShowConfirmMdp] = useState(false);

  // ── MFA ────────────────────────────────────────────────────────────────────
  const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean; method?: string; backupCodesRemaining: number } | null>(null);
  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaOk, setMfaOk] = useState<string | null>(null);
  const [mfaErr, setMfaErr] = useState<string | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!token || !role) return;
    try {
      const meRes = await api.get('/auth/me');
      const me = meRes.data.data;
      const sub = role === 'CLIENTE' ? me.cliente : role === 'COIFFEUSE' ? me.coiffeuse : me.admin;
      setProfil({
        nom: sub?.nom || '',
        prenom: sub?.prenom || '',
        telephone: sub?.telephone || '',
        email: me.email || '',
        bio: sub?.bio || '',
        specialites: Array.isArray(sub?.specialites) ? sub.specialites.join(', ') : '',
        niveau: sub?.niveau || '',
      });
      if (role === 'COIFFEUSE' && sub?.disponibilites) {
        const d: Record<string, { ouvert: boolean; debut: string; fin: string }> = { ...DEFAULT_HORAIRES };
        (sub.disponibilites as { jourSemaine: number; heureDebut: string; heureFin: string; actif: boolean }[]).forEach((dispo) => {
          const jour = JOURS.find((j) => JOURS_SEMAINE_NUM[j.key] === dispo.jourSemaine);
          if (jour) d[jour.key] = { ouvert: dispo.actif ?? true, debut: dispo.heureDebut || '09:00', fin: dispo.heureFin || '18:00' };
        });
        setDispos(d);
      }
    } catch { /* silent */ }

    if (role === 'ADMIN') {
      try {
        const pRes = await api.get('/admin/parametres');
        const p = pRes.data.data;
        setSalon({
          nomSalon: p.nomSalon || '',
          slogan: p.slogan || '',
          adresse: p.adresse || '',
          ville: p.ville || '',
          telephone: p.telephone || '',
          emailContact: p.emailContact || '',
          description: p.description || '',
          googleMapsUrl: p.googleMapsUrl || '',
          dureeSlotMin: p.dureeSlotMin ?? 30,
          avanceMaxJours: p.avanceMaxJours ?? 60,
          delaiAnnulationH: p.delaiAnnulationH ?? 24,
          horaireOuverture: p.horaireOuverture || DEFAULT_HORAIRES,
        });
      } catch { /* silent */ }
    }

    // Load MFA status for all roles
    try {
      const mfaRes = await api.get('/mfa/status');
      setMfaStatus(mfaRes.data.data);
    } catch { /* silent */ }
  }, [token, role]);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!token) { router.push('/connexion?redirect=/parametres'); return; }
    loadData();
  }, [_hasHydrated, token, router, loadData]);

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Chargement…</div>
      </div>
    );
  }
  if (!token) return null;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const saveSalon = async () => {
    setSalonLoading(true); setSalonErr(null);
    try {
      await api.put('/admin/parametres', {
        ...salon,
        horaireOuverture: salon.horaireOuverture,
      });
      setSalonOk('Paramètres du salon mis à jour !');
      setTimeout(() => setSalonOk(null), 3000);
    } catch (e) {
      setSalonErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    } finally {
      setSalonLoading(false);
    }
  };

  const saveProfil = async () => {
    setProfilLoading(true); setProfilErr(null);
    try {
      const payload: Record<string, unknown> = {
        nom: profil.nom,
        prenom: profil.prenom,
        telephone: profil.telephone,
        email: profil.email,
      };
      if (role === 'COIFFEUSE') {
        payload.bio = profil.bio;
        payload.specialites = profil.specialites?.split(',').map((s) => s.trim()).filter(Boolean);
        payload.niveau = profil.niveau;
      }
      await api.put('/auth/profil', payload);
      setProfilOk('Profil mis à jour !');
      setTimeout(() => setProfilOk(null), 3000);
    } catch (e) {
      setProfilErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    } finally {
      setProfilLoading(false);
    }
  };

  const saveDispos = async () => {
    setDispoLoading(true); setDispoErr(null);
    try {
      const disponibilites = JOURS.map((j) => ({
        jourSemaine: JOURS_SEMAINE_NUM[j.key],
        heureDebut: dispos[j.key].debut,
        heureFin: dispos[j.key].fin,
        actif: dispos[j.key].ouvert,
      }));
      await api.put('/coiffeuses/me/disponibilites', { disponibilites });
      setDispoOk('Disponibilités mises à jour !');
      setTimeout(() => setDispoOk(null), 3000);
    } catch (e) {
      setDispoErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    } finally {
      setDispoLoading(false);
    }
  };

  const savePassword = async () => {
    if (nouveauMdp !== confirmMdp) { setMdpErr('Les mots de passe ne correspondent pas.'); return; }
    if (nouveauMdp.length < 8) { setMdpErr('8 caractères minimum.'); return; }
    setMdpLoading(true); setMdpErr(null);
    try {
      await api.put('/auth/password', { ancienMotDePasse: ancienMdp, nouveauMotDePasse: nouveauMdp });
      setMdpOk('Mot de passe modifié avec succès !');
      setAncienMdp(''); setNouveauMdp(''); setConfirmMdp('');
      setTimeout(() => setMdpOk(null), 3000);
    } catch (e) {
      setMdpErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    } finally {
      setMdpLoading(false);
    }
  };

  const startMfaSetup = async () => {
    setMfaLoading(true); setMfaErr(null);
    try {
      const res = await api.post('/mfa/totp/setup');
      setMfaQr(res.data.data.qrCode);
      setMfaSecret(res.data.data.secret);
      setMfaStep('setup');
      setMfaCode('');
    } catch { setMfaErr('Erreur lors de la configuration.'); }
    finally { setMfaLoading(false); }
  };

  const verifyMfaSetup = async () => {
    if (!/^\d{6}$/.test(mfaCode)) { setMfaErr('Code à 6 chiffres requis.'); return; }
    setMfaLoading(true); setMfaErr(null);
    try {
      await api.post('/mfa/totp/verify-setup', { code: mfaCode });
      setMfaOk('Double authentification activée avec succès !');
      setMfaStep('idle');
      setMfaQr(null); setMfaSecret(null); setMfaCode('');
      const mfaRes = await api.get('/mfa/status');
      setMfaStatus(mfaRes.data.data);
      setTimeout(() => setMfaOk(null), 4000);
    } catch { setMfaErr('Code incorrect. Vérifiez votre application.'); }
    finally { setMfaLoading(false); }
  };

  const disableMfa = async () => {
    if (!confirm('Désactiver la double authentification ? Cela réduit la sécurité de votre compte.')) return;
    setMfaLoading(true); setMfaErr(null);
    try {
      await api.post('/mfa/disable');
      setMfaOk('Double authentification désactivée.');
      const mfaRes = await api.get('/mfa/status');
      setMfaStatus(mfaRes.data.data);
      setTimeout(() => setMfaOk(null), 3000);
    } catch { setMfaErr('Erreur lors de la désactivation.'); }
    finally { setMfaLoading(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-3">
            <Settings className="h-7 w-7" />
            <div>
              <h1 className="text-2xl font-bold">Paramètres</h1>
              <p className="text-purple-100 mt-0.5 text-sm">
                Gérez votre compte et vos préférences
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* ── Forced password-change banner ─────────────────────────────── */}
        {forceChange && (
          <div className="mb-6 bg-amber-50 border border-amber-400 rounded-xl px-5 py-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">Changement de mot de passe requis</p>
              <p className="text-amber-700 text-sm mt-0.5">
                Pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant de continuer.
              </p>
            </div>
          </div>
        )}

        {/* ── ADMIN: Paramètres du salon ─────────────────────────────────── */}
        {role === 'ADMIN' && (
          <Section title="Paramètres du salon" icon={Building}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Nom du salon</label>
                <input
                  aria-label="Nom du salon"
                  className="input"
                  value={salon.nomSalon}
                  onChange={(e) => setSalon({ ...salon, nomSalon: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Slogan</label>
                <input
                  aria-label="Slogan"
                  className="input"
                  value={salon.slogan}
                  onChange={(e) => setSalon({ ...salon, slogan: e.target.value })}
                  placeholder="Votre slogan…"
                />
              </div>
              <div>
                <label className="label"><MapPin className="h-3.5 w-3.5 inline mr-1" />Adresse</label>
                <input
                  aria-label="Adresse"
                  className="input"
                  value={salon.adresse}
                  onChange={(e) => setSalon({ ...salon, adresse: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Ville</label>
                <input
                  aria-label="Ville"
                  className="input"
                  value={salon.ville}
                  onChange={(e) => setSalon({ ...salon, ville: e.target.value })}
                />
              </div>
              <div>
                <label className="label"><Phone className="h-3.5 w-3.5 inline mr-1" />Téléphone</label>
                <input
                  aria-label="Téléphone du salon"
                  className="input"
                  value={salon.telephone}
                  onChange={(e) => setSalon({ ...salon, telephone: e.target.value })}
                />
              </div>
              <div>
                <label className="label"><Mail className="h-3.5 w-3.5 inline mr-1" />Email de contact</label>
                <input
                  aria-label="Email de contact"
                  type="email"
                  className="input"
                  value={salon.emailContact}
                  onChange={(e) => setSalon({ ...salon, emailContact: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Description</label>
                <textarea
                  aria-label="Description"
                  rows={3}
                  className="input resize-none"
                  value={salon.description}
                  onChange={(e) => setSalon({ ...salon, description: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label"><ExternalLink className="h-3.5 w-3.5 inline mr-1" />Lien Google Maps (optionnel)</label>
                <input
                  aria-label="Lien Google Maps"
                  type="url"
                  className="input"
                  value={salon.googleMapsUrl}
                  onChange={(e) => setSalon({ ...salon, googleMapsUrl: e.target.value })}
                  placeholder="https://maps.google.com/..."
                />
              </div>

              <div>
                <label className="label">Durée d&apos;un créneau (min)</label>
                <input
                  aria-label="Durée d'un créneau en minutes"
                  type="number"
                  min={15}
                  step={15}
                  className="input"
                  value={salon.dureeSlotMin}
                  onChange={(e) => setSalon({ ...salon, dureeSlotMin: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Réservation max (jours à l&apos;avance)</label>
                <input
                  aria-label="Réservation maximum en jours à l'avance"
                  type="number"
                  min={1}
                  className="input"
                  value={salon.avanceMaxJours}
                  onChange={(e) => setSalon({ ...salon, avanceMaxJours: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Délai d&apos;annulation (heures)</label>
                <input
                  aria-label="Délai d'annulation en heures"
                  type="number"
                  min={0}
                  className="input"
                  value={salon.delaiAnnulationH}
                  onChange={(e) => setSalon({ ...salon, delaiAnnulationH: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Horaires */}
            <div className="mt-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Horaires d&apos;ouverture
              </h4>
              <div className="space-y-2">
                {JOURS.map((jour) => {
                  const h = salon.horaireOuverture[jour.key] || { ouvert: false, debut: '09:00', fin: '19:00' };
                  return (
                    <div key={jour.key} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 w-28 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={h.ouvert}
                          onChange={(e) =>
                            setSalon({
                              ...salon,
                              horaireOuverture: {
                                ...salon.horaireOuverture,
                                [jour.key]: { ...h, ouvert: e.target.checked },
                              },
                            })
                          }
                          className="accent-purple-600"
                        />
                        <span className="text-sm text-gray-700">{jour.label}</span>
                      </label>
                      {h.ouvert ? (
                        <>
                          <input
                            aria-label={`Heure d'ouverture - ${jour.label}`}
                            type="time"
                            value={h.debut}
                            onChange={(e) =>
                              setSalon({
                                ...salon,
                                horaireOuverture: {
                                  ...salon.horaireOuverture,
                                  [jour.key]: { ...h, debut: e.target.value },
                                },
                              })
                            }
                            className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24 focus:ring-2 focus:ring-purple-200 outline-none"
                          />
                          <span className="text-gray-400 text-sm">→</span>
                          <input
                            aria-label={`Heure de fermeture - ${jour.label}`}
                            type="time"
                            value={h.fin}
                            onChange={(e) =>
                              setSalon({
                                ...salon,
                                horaireOuverture: {
                                  ...salon.horaireOuverture,
                                  [jour.key]: { ...h, fin: e.target.value },
                                },
                              })
                            }
                            className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24 focus:ring-2 focus:ring-purple-200 outline-none"
                          />
                        </>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Fermé</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <SaveBar onSave={saveSalon} loading={salonLoading} ok={salonOk} err={salonErr} />
          </Section>
        )}

        {/* ── Mon profil ──────────────────────────────────────────────────── */}
        <Section title="Mon profil" icon={User}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Prénom</label>
              <input
                aria-label="Prénom"
                className="input"
                value={profil.prenom}
                onChange={(e) => setProfil({ ...profil, prenom: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Nom</label>
              <input
                aria-label="Nom"
                className="input"
                value={profil.nom}
                onChange={(e) => setProfil({ ...profil, nom: e.target.value })}
              />
            </div>
            <div>
              <label className="label"><Phone className="h-3.5 w-3.5 inline mr-1" />Téléphone</label>
              <input
                aria-label="Téléphone"
                type="tel"
                className="input"
                value={profil.telephone}
                onChange={(e) => setProfil({ ...profil, telephone: e.target.value })}
              />
            </div>
            <div>
              <label className="label"><Mail className="h-3.5 w-3.5 inline mr-1" />Email</label>
              <input
                aria-label="Email"
                type="email"
                className="input"
                value={profil.email}
                onChange={(e) => setProfil({ ...profil, email: e.target.value })}
              />
            </div>
            {role === 'COIFFEUSE' && (
              <>
                <div className="md:col-span-2">
                  <label className="label">Bio</label>
                  <textarea
                    rows={3}
                    className="input resize-none"
                    value={profil.bio ?? ''}
                    onChange={(e) => setProfil({ ...profil, bio: e.target.value })}
                    placeholder="Parlez de vous, de votre expérience…"
                  />
                </div>
                <div>
                  <label className="label">Spécialités (séparées par des virgules)</label>
                  <input
                    className="input"
                    value={profil.specialites ?? ''}
                    onChange={(e) => setProfil({ ...profil, specialites: e.target.value })}
                    placeholder="Ex: Couleur, Coupe, Tresses"
                  />
                </div>
                <div>
                  <label className="label">Niveau</label>
                  <select
                    aria-label="Niveau"
                    className="input"
                    value={profil.niveau ?? ''}
                    onChange={(e) => setProfil({ ...profil, niveau: e.target.value })}
                  >
                    <option value="">— Choisir —</option>
                    <option value="JUNIOR">Junior</option>
                    <option value="CONFIRME">Confirmé(e)</option>
                    <option value="SENIOR">Senior</option>
                    <option value="EXPERT">Expert(e)</option>
                    <option value="EXPERTE">Expert(e)</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <SaveBar onSave={saveProfil} loading={profilLoading} ok={profilOk} err={profilErr} />
        </Section>

        {/* ── COIFFEUSE: Mes disponibilités ───────────────────────────────── */}
        {role === 'COIFFEUSE' && (
          <Section title="Mes disponibilités" icon={Clock}>
            <div className="space-y-2">
              {JOURS.map((jour) => {
                const d = dispos[jour.key] || { ouvert: false, debut: '09:00', fin: '19:00' };
                return (
                  <div key={jour.key} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 w-28 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.ouvert}
                        onChange={(e) =>
                          setDispos({ ...dispos, [jour.key]: { ...d, ouvert: e.target.checked } })
                        }
                        className="accent-purple-600"
                      />
                      <span className="text-sm text-gray-700">{jour.label}</span>
                    </label>
                    {d.ouvert ? (
                      <>
                        <input
                          aria-label={`Début - ${jour.label}`}
                          type="time"
                          value={d.debut}
                          onChange={(e) =>
                            setDispos({ ...dispos, [jour.key]: { ...d, debut: e.target.value } })
                          }
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24 focus:ring-2 focus:ring-purple-200 outline-none"
                        />
                        <span className="text-gray-400 text-sm">→</span>
                        <input
                          aria-label={`Fin - ${jour.label}`}
                          type="time"
                          value={d.fin}
                          onChange={(e) =>
                            setDispos({ ...dispos, [jour.key]: { ...d, fin: e.target.value } })
                          }
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24 focus:ring-2 focus:ring-purple-200 outline-none"
                        />
                      </>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Non disponible</span>
                    )}
                  </div>
                );
              })}
            </div>
            <SaveBar onSave={saveDispos} loading={dispoLoading} ok={dispoOk} err={dispoErr} />
          </Section>
        )}

        {/* ── Sécurité: Changer le mot de passe ──────────────────────────── */}
        <Section title="Sécurité" icon={Lock}>
          <div className="max-w-md space-y-4">
            <div>
              <label className="label">Mot de passe actuel</label>
              <div className="relative">
                <input
                  aria-label="Mot de passe actuel"
                  type={showAncienMdp ? 'text' : 'password'}
                  className="input pr-10"
                  value={ancienMdp}
                  onChange={(e) => setAncienMdp(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowAncienMdp((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showAncienMdp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  aria-label="Nouveau mot de passe"
                  type={showNouveauMdp ? 'text' : 'password'}
                  className="input pr-10"
                  value={nouveauMdp}
                  onChange={(e) => setNouveauMdp(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowNouveauMdp((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNouveauMdp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">8 caractères minimum</p>
            </div>
            <div>
              <label className="label">Confirmer le nouveau mot de passe</label>
              <div className="relative">
                <input
                  aria-label="Confirmer le nouveau mot de passe"
                  type={showConfirmMdp ? 'text' : 'password'}
                  className="input pr-10"
                  value={confirmMdp}
                  onChange={(e) => setConfirmMdp(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirmMdp((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirmMdp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <SaveBar onSave={savePassword} loading={mdpLoading} ok={mdpOk} err={mdpErr} />
        </Section>

        {/* ── Double authentification ─────────────────────────────────────── */}
        <Section title="Double authentification (2FA)" icon={Lock}>
          {mfaOk && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{mfaOk}</div>}
          {mfaErr && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{mfaErr}</div>}

          {/* Status badge */}
          <div className="flex items-center gap-3 mb-5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${mfaStatus?.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${mfaStatus?.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              {mfaStatus?.enabled ? `Activé (${mfaStatus.method ?? 'TOTP'})` : 'Désactivé'}
            </span>
            {mfaStatus?.enabled && mfaStatus.backupCodesRemaining > 0 && (
              <span className="text-xs text-gray-400">{mfaStatus.backupCodesRemaining} code{mfaStatus.backupCodesRemaining > 1 ? 's' : ''} de secours restant{mfaStatus.backupCodesRemaining > 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Disabled state: offer to enable */}
          {!mfaStatus?.enabled && mfaStep === 'idle' && (
            <button
              onClick={startMfaSetup}
              disabled={mfaLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60 transition-colors"
            >
              {mfaLoading ? 'Chargement…' : 'Activer la double authentification TOTP'}
            </button>
          )}

          {/* Setup step: show QR + secret */}
          {mfaStep === 'setup' && mfaQr && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                1. Scannez ce QR code avec une application comme <strong>Google Authenticator</strong> ou <strong>Authy</strong>.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mfaQr} alt="QR code TOTP" className="w-48 h-48 border rounded-lg" />
              {mfaSecret && (
                <p className="text-xs text-gray-500">
                  Clé manuelle : <code className="bg-gray-100 px-1 py-0.5 rounded select-all">{mfaSecret}</code>
                </p>
              )}
              <p className="text-sm text-gray-600">2. Entrez le code à 6 chiffres affiché dans l&apos;application :</p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => { setMfaCode(e.target.value.replace(/\D/g, '')); setMfaErr(null); }}
                  placeholder="000000"
                  className="input w-36 text-center tracking-[0.5em] text-lg"
                />
                <button
                  onClick={verifyMfaSetup}
                  disabled={mfaLoading || mfaCode.length !== 6}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60 transition-colors"
                >
                  {mfaLoading ? 'Vérification…' : 'Confirmer'}
                </button>
                <button
                  onClick={() => { setMfaStep('idle'); setMfaQr(null); setMfaSecret(null); setMfaCode(''); setMfaErr(null); }}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Enabled state: offer to disable */}
          {mfaStatus?.enabled && mfaStep === 'idle' && (
            <button
              onClick={disableMfa}
              disabled={mfaLoading}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-60 transition-colors"
            >
              {mfaLoading ? 'Chargement…' : 'Désactiver la double authentification'}
            </button>
          )}
        </Section>

      </div>

      {/* Utility styles via Tailwind @apply alternative — inline className helpers */}
      <style jsx global>{`
        .label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.25rem;
        }
        .input {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #111827;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus {
          border-color: #a855f7;
          box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
        }
      `}</style>
    </div>
  );
}

export default function ParametresPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400 text-sm">Chargement…</div></div>}>
      <ParametresContent />
    </Suspense>
  );
}
