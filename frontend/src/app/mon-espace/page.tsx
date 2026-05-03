'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Star, User, Edit3, ChevronRight, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import api from '../../lib/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RendezVous {
  id: string;
  dateHeure: string;
  statut: string;
  prixTotal: number;
  dureeTotal: number;
  notes?: string;
  coiffeuse: { prenom: string; nom: string };
  services: { service: { nom: string; prix: number } }[];
  avis?: { id: string; note: number; commentaire?: string } | null;
}

interface Profil {
  id: string;
  typeCheveux?: string;
  longueurCheveux?: string;
  etatCheveux?: string;
  historiqueChimique?: string;
  allergiesConnues?: string;
  user: { nom: string; prenom: string; email: string; telephone?: string };
}

interface AvisExistant {
  id: string;
  note: number;
  commentaire?: string;
  rendezVousId: string;
}

const TABS = [
  { id: 'rdv', label: 'Mes rendez-vous', icon: Calendar },
  { id: 'profil', label: 'Mon profil capillaire', icon: User },
  { id: 'avis', label: 'Mes avis', icon: Star },
];

const statutColors: Record<string, string> = {
  EN_ATTENTE: 'bg-yellow-100 text-yellow-700',
  CONFIRME: 'bg-blue-100 text-blue-700',
  EN_COURS: 'bg-purple-100 text-purple-700',
  TERMINE: 'bg-green-100 text-green-700',
  ANNULE: 'bg-red-100 text-red-700',
};

const statutLabels: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRME: 'Confirmé',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

function MonEspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, _hasHydrated } = useAuthStore();
  const [tab, setTab] = useState('rdv');
  const [rdvList, setRdvList] = useState<RendezVous[]>([]);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [loading, setLoading] = useState(true);
  const [editProfil, setEditProfil] = useState(false);
  const [profilForm, setProfilForm] = useState<Record<string, string>>({
    typeCheveux: '',
    longueurCheveux: '',
    etatCheveux: '',
    historiqueChimique: '',
    allergiesConnues: '',
  });

  // Avis state
  const [avisExistants, setAvisExistants] = useState<AvisExistant[]>([]);
  const [avisForm, setAvisForm] = useState<Record<string, { note: number; commentaire: string }>>({});
  const [avisSubmitting, setAvisSubmitting] = useState<string | null>(null);
  const [avisSuccess, setAvisSuccess] = useState<string | null>(null);

  const success = searchParams.get('success');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rdvRes, profilRes] = await Promise.all([
        api.get('/clientes/historique'),
        api.get('/clientes/profil'),
      ]);
      const rdvData = rdvRes.data.data;
      const rdvs: RendezVous[] = Array.isArray(rdvData) ? rdvData : (rdvData?.rdvs || []);
      setRdvList(rdvs);
      // Extract existing avis from rdvs
      const existants: AvisExistant[] = rdvs
        .filter((r) => r.avis)
        .map((r) => ({ id: r.avis!.id, note: r.avis!.note, commentaire: r.avis!.commentaire, rendezVousId: r.id }));
      setAvisExistants(existants);
      setProfil(profilRes.data.data || null);
      if (profilRes.data.data) {
        const p = profilRes.data.data;
        setProfilForm({
          typeCheveux: p.typeCheveux || '',
          longueurCheveux: p.longueurCheveux || '',
          etatCheveux: p.etatCheveux || '',
          historiqueChimique: p.historiqueChimique || '',
          allergiesConnues: p.allergiesConnues || '',
        });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!token) {
      router.push('/connexion?redirect=/mon-espace');
      return;
    }
    loadData();
  }, [_hasHydrated, token, router, loadData]);

  const handleUpdateProfil = async () => {
    try {
      await api.put('/clientes/profil', profilForm);
      setEditProfil(false);
      loadData();
    } catch {
      // silent
    }
  };

  const handleAnnuler = async (id: string) => {
    if (!confirm('Annuler ce rendez-vous ?')) return;
    try {
      await api.delete(`/rendez-vous/${id}`);
      loadData();
    } catch {
      // silent
    }
  };

  const handleSubmitAvis = async (rdvId: string) => {
    const form = avisForm[rdvId];
    if (!form || !form.note) return;
    setAvisSubmitting(rdvId);
    try {
      await api.post('/clientes/avis', {
        rendezVousId: rdvId,
        note: form.note,
        commentaire: form.commentaire || undefined,
      });
      setAvisSuccess(rdvId);
      await loadData();
      setTimeout(() => setAvisSuccess(null), 3000);
    } catch {
      // silent
    } finally {
      setAvisSubmitting(null);
    }
  };

  const upcomingRdv = rdvList.filter((r) => ['EN_ATTENTE', 'CONFIRME'].includes(r.statut));
  const pastRdv = rdvList.filter((r) => ['TERMINE', 'ANNULE', 'EN_COURS'].includes(r.statut));
  const rdvSansAvis = rdvList.filter((r) => r.statut === 'TERMINE' && !r.avis);

  if (!_hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Chargement…</div>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white py-8">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-3xl font-bold">Mon espace</h1>
          <p className="text-pink-100 mt-1">
            Bonjour {user?.prenom} ! Gérez vos rendez-vous et votre profil
          </p>
        </div>
      </div>

      {success === 'reservation' && (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg">
            <CheckCircle className="h-5 w-5" />
            Votre rendez-vous a été réservé avec succès !
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm mb-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                tab === t.id
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : (
          <>
            {/* Rendez-vous Tab */}
            {tab === 'rdv' && (
              <div className="space-y-8">
                {/* Upcoming */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Prochains rendez-vous</h2>
                    <button
                      onClick={() => router.push('/reservation')}
                      className="text-sm text-pink-600 font-medium hover:underline flex items-center gap-1"
                    >
                      Nouveau RDV <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  {upcomingRdv.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-400">
                      Aucun rendez-vous à venir
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingRdv.map((r) => (
                        <div
                          key={r.id}
                          className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {format(new Date(r.dateHeure), 'EEEE d MMMM yyyy à HH:mm', {
                                  locale: fr,
                                })}
                              </p>
                              <p className="text-sm text-gray-500 mt-0.5">
                                Avec {r.coiffeuse.prenom} {r.coiffeuse.nom}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {r.services.map((s, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full"
                                  >
                                    {s.service.nom}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right space-y-2">
                              <span
                                className={`text-xs px-2.5 py-1 rounded-full font-medium ${statutColors[r.statut]}`}
                              >
                                {statutLabels[r.statut]}
                              </span>
                              <p className="text-sm font-bold text-pink-600">{r.prixTotal} dt</p>
                            </div>
                          </div>
                          {r.statut === 'EN_ATTENTE' && (
                            <div className="mt-3 pt-3 border-t">
                              <button
                                onClick={() => handleAnnuler(r.id)}
                                className="text-sm text-red-500 hover:underline"
                              >
                                Annuler ce rendez-vous
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Past */}
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Historique</h2>
                  {pastRdv.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-400">
                      Aucun rendez-vous passé
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pastRdv.map((r) => (
                        <div
                          key={r.id}
                          className="bg-white rounded-xl p-4 border border-gray-100 opacity-75"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-gray-700">
                                {format(new Date(r.dateHeure), 'd MMM yyyy - HH:mm', {
                                  locale: fr,
                                })}
                              </p>
                              <p className="text-sm text-gray-400">
                                {r.services.map((s) => s.service.nom).join(', ')}
                              </p>
                            </div>
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-medium ${statutColors[r.statut]}`}
                            >
                              {statutLabels[r.statut]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profil capillaire */}
            {tab === 'profil' && (
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Mon profil capillaire</h2>
                  <button
                    onClick={() => setEditProfil(!editProfil)}
                    className="text-sm text-pink-600 font-medium flex items-center gap-1"
                  >
                    <Edit3 className="h-4 w-4" />
                    {editProfil ? 'Annuler' : 'Modifier'}
                  </button>
                </div>

                {editProfil ? (
                  <div className="space-y-4">
                    {[
                      { key: 'typeCheveux', label: 'Type de cheveux', placeholder: 'Ex: Bouclés, Crépus, Lisses...' },
                      { key: 'longueurCheveux', label: 'Longueur', placeholder: 'Ex: Mi-longs, Longs...' },
                      { key: 'etatCheveux', label: 'État actuel', placeholder: 'Ex: Secs, Normaux, Gras...' },
                      { key: 'historiqueChimique', label: 'Historique chimique', placeholder: 'Colorations, lissages précédents...' },
                      { key: 'allergiesConnues', label: 'Allergies connues', placeholder: 'Produits à éviter...' },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {f.label}
                        </label>
                        <input
                          value={profilForm[f.key]}
                          onChange={(e) =>
                            setProfilForm((p) => ({ ...p, [f.key]: e.target.value }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                          placeholder={f.placeholder}
                        />
                      </div>
                    ))}
                    <button
                      onClick={handleUpdateProfil}
                      className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-2.5 rounded-lg font-medium hover:shadow-lg transition-all"
                    >
                      Enregistrer
                    </button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { label: 'Type de cheveux', value: profil?.typeCheveux },
                      { label: 'Longueur', value: profil?.longueurCheveux },
                      { label: 'État actuel', value: profil?.etatCheveux },
                      { label: 'Historique chimique', value: profil?.historiqueChimique },
                      { label: 'Allergies', value: profil?.allergiesConnues },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50 rounded-lg p-4">
                        <span className="text-xs text-gray-400 uppercase">{item.label}</span>
                        <p className="text-gray-900 font-medium mt-0.5">
                          {item.value || 'Non renseigné'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Avis */}
            {tab === 'avis' && (
              <div className="space-y-6">
                {/* Avis déjà laissés */}
                {avisExistants.length > 0 && (
                  <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Mes avis laissés</h2>
                    <div className="space-y-4">
                      {rdvList.filter((r) => r.avis).map((r) => (
                        <div key={r.id} className="border border-gray-100 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                {format(new Date(r.dateHeure), 'dd MMMM yyyy', { locale: fr })} · {r.coiffeuse.prenom} {r.coiffeuse.nom}
                              </p>
                              <p className="text-xs text-gray-400">{r.services.map((s) => s.service.nom).join(', ')}</p>
                            </div>
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map((n) => (
                                <Star key={n} className={`h-4 w-4 ${n <= (r.avis?.note || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                              ))}
                            </div>
                          </div>
                          {r.avis?.commentaire && (
                            <p className="text-sm text-gray-600 italic">&ldquo;{r.avis.commentaire}&rdquo;</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RDV sans avis */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Laisser un avis</h2>
                  {rdvSansAvis.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      {rdvList.filter((r) => r.statut === 'TERMINE').length === 0
                        ? 'Vous pourrez laisser un avis après chaque rendez-vous terminé.'
                        : 'Vous avez déjà laissé un avis pour tous vos rendez-vous terminés.'}
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {rdvSansAvis.map((r) => {
                        const form = avisForm[r.id] || { note: 0, commentaire: '' };
                        return (
                          <div key={r.id} className="border border-gray-100 rounded-xl p-5">
                            <div className="mb-3">
                              <p className="font-medium text-gray-800">
                                {format(new Date(r.dateHeure), 'dd MMMM yyyy', { locale: fr })}
                              </p>
                              <p className="text-sm text-gray-500">
                                {r.coiffeuse.prenom} {r.coiffeuse.nom} · {r.services.map((s) => s.service.nom).join(', ')}
                              </p>
                            </div>

                            <div className="mb-3">
                              <p className="text-sm text-gray-600 mb-1.5 font-medium">Note</p>
                              <div className="flex gap-1">
                                {[1,2,3,4,5].map((n) => (
                                  <button
                                    key={n}
                                    onClick={() => setAvisForm((prev) => ({ ...prev, [r.id]: { ...form, note: n } }))}
                                    aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
                                  >
                                    <Star className={`h-7 w-7 transition-colors ${n <= form.note ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`} />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="mb-4">
                              <label className="text-sm text-gray-600 mb-1.5 font-medium block">Commentaire (optionnel)</label>
                              <textarea
                                rows={2}
                                value={form.commentaire}
                                onChange={(e) => setAvisForm((prev) => ({ ...prev, [r.id]: { ...form, commentaire: e.target.value } }))}
                                placeholder="Décrivez votre expérience…"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-200 focus:border-pink-400 outline-none resize-none"
                              />
                            </div>

                            {avisSuccess === r.id && (
                              <div className="flex items-center gap-2 text-green-600 text-sm mb-3">
                                <CheckCircle className="h-4 w-4" /> Merci pour votre avis !
                              </div>
                            )}

                            <button
                              onClick={() => handleSubmitAvis(r.id)}
                              disabled={!form.note || avisSubmitting === r.id}
                              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                            >
                              {avisSubmitting === r.id ? 'Envoi…' : 'Publier mon avis'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MonEspacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400 text-sm">Chargement…</div></div>}>
      <MonEspaceContent />
    </Suspense>
  );
}
