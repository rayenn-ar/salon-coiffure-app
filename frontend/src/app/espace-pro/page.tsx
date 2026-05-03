'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Image,
  Package,
  Plus,
  X,
  UserPlus,
} from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import api from '../../lib/api';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RdvPro {
  id: string;
  dateHeure: string;
  statut: string;
  prixTotal: number;
  dureeEstimee?: number;
  notes?: string;
  typeRdv?: string;
  walkInNom?: string;
  walkInTelephone?: string;
  cliente?: { prenom: string; nom: string; telephone?: string };
  services: { service: { nom: string } }[];
}

interface Service {
  id: string;
  nom: string;
  duree: number;
  prix: number;
  categorie?: string;
}

interface ServiceAPI {
  id: string;
  nom: string;
  dureeMinutes: number;
  prixBase: string;
  categorie?: string;
}

interface Produit {
  id: string;
  nom: string;
  unite: string;
  categorie?: string;
}

interface Cliente {
  id: string;
  prenom: string;
  nom: string;
  telephone: string | null;
  profilCapillaire: string | null;
  derniereVisite: string;
  nombreVisites: number;
  services: string[];
}

interface LigneSaisie {
  produitId: string;
  quantite: string;
}

const TABS = [
  { id: 'agenda', label: 'Mon agenda', icon: Calendar },
  { id: 'presentiel', label: 'Client présentiel', icon: UserPlus },
  { id: 'clients', label: 'Mes clientes', icon: Users },
  { id: 'matieres', label: 'Matières utilisées', icon: Package },
  { id: 'portfolio', label: 'Portfolio', icon: Image },
];

const statutColors: Record<string, string> = {
  EN_ATTENTE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CONFIRME: 'bg-blue-100 text-blue-700 border-blue-200',
  EN_COURS: 'bg-purple-100 text-purple-700 border-purple-200',
  TERMINE: 'bg-green-100 text-green-700 border-green-200',
  ANNULE: 'bg-red-100 text-red-700 border-red-200',
};

const statutLabels: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRME: 'Confirmé',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

export default function EspaceProPage() {
  const router = useRouter();
  const { user, token, _hasHydrated } = useAuthStore();
  const [tab, setTab] = useState('agenda');
  const [rdvList, setRdvList] = useState<RdvPro[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Stock traceability state
  const [produitsDispos, setProduitsDispos] = useState<Produit[]>([]);
  const [saisieRdvId, setSaisieRdvId] = useState<string | null>(null);
  const [lignes, setLignes] = useState<LigneSaisie[]>([{ produitId: '', quantite: '' }]);

  // Mes clientes state
  const [mesClientes, setMesClientes] = useState<Cliente[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [saisieOk, setSaisieOk] = useState<string | null>(null);

  // Walk-in form state
  const [servicesDispos, setServicesDispos] = useState<Service[]>([]);
  const [wiNom, setWiNom] = useState('');
  const [wiTel, setWiTel] = useState('');
  const [wiDate, setWiDate] = useState('');
  const [wiTime, setWiTime] = useState('');
  const [wiServices, setWiServices] = useState<string[]>([]);
  const [wiNote, setWiNote] = useState('');
  const [wiLoading, setWiLoading] = useState(false);
  const [wiOk, setWiOk] = useState<string | null>(null);
  const [wiErr, setWiErr] = useState<string | null>(null);
  const [saisieErr, setSaisieErr] = useState<string | null>(null);

  const loadRDV = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/rendez-vous');
      setRdvList(res.data.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!token) { router.push('/connexion?redirect=/espace-pro'); return; }
    if (user?.role !== 'COIFFEUSE') { router.push('/'); return; }
    loadRDV();
    // Load available products for traceability
    api.get('/coiffeuses/produits').then((r) => setProduitsDispos(r.data.data || [])).catch(() => {});
    // Load services for walk-in form
    api.get('/services').then((r) => {
      const mapped = (r.data.data || []).map((s: ServiceAPI) => ({
        id: s.id,
        nom: s.nom,
        duree: s.dureeMinutes,
        prix: parseFloat(s.prixBase) || 0,
        categorie: s.categorie,
      }));
      setServicesDispos(mapped);
    }).catch(() => {});
  }, [_hasHydrated, token, user, router, loadRDV]);

  useEffect(() => {
    if (tab !== 'clients' || mesClientes.length > 0) return;
    setClientesLoading(true);
    api.get('/coiffeuses/mes-clientes')
      .then((r) => setMesClientes(r.data.data || []))
      .catch(() => {})
      .finally(() => setClientesLoading(false));
  }, [tab, mesClientes.length]);

  if (!_hasHydrated || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Chargement…</div>
      </div>
    );
  }
  if (!token || user?.role !== 'COIFFEUSE') return null;

  const handleStatut = async (id: string, statut: string) => {
    try {
      await api.patch(`/rendez-vous/${id}/statut`, { statut });
      loadRDV();
    } catch {
      // silent
    }
  };

  // Stock saisie handlers
  const openSaisie = (rdvId: string) => {
    setSaisieRdvId(rdvId);
    setLignes([{ produitId: '', quantite: '' }]);
    setSaisieOk(null);
    setSaisieErr(null);
  };

  const addLigne = () => setLignes((l) => [...l, { produitId: '', quantite: '' }]);
  const removeLigne = (i: number) => setLignes((l) => l.filter((_, idx) => idx !== i));
  const updateLigne = (i: number, field: keyof LigneSaisie, value: string) =>
    setLignes((l) => l.map((ln, idx) => (idx === i ? { ...ln, [field]: value } : ln)));

  const submitSaisie = async () => {
    if (!saisieRdvId) return;
    const valides = lignes.filter((l) => l.produitId && parseFloat(l.quantite) > 0);
    if (valides.length === 0) { setSaisieErr('Ajoutez au moins un produit avec une quantité valide.'); return; }
    try {
      await api.post(`/rendez-vous/${saisieRdvId}/matieres`, {
        matieres: valides.map((l) => ({ produitId: l.produitId, quantite: parseFloat(l.quantite) })),
      });
      setSaisieOk('Matières sauvegardées avec succès !');
      setSaisieErr(null);
      setTimeout(() => { setSaisieRdvId(null); setSaisieOk(null); }, 2000);
    } catch {
      setSaisieErr('Erreur lors de la sauvegarde.');
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const getRdvForDay = (date: Date) =>
    rdvList.filter((r) => isSameDay(new Date(r.dateHeure), date) && r.statut !== 'ANNULE');
  const todayRdv = rdvList.filter((r) => isToday(new Date(r.dateHeure)) && r.statut !== 'ANNULE');
  const pendingCount = rdvList.filter((r) => r.statut === 'EN_ATTENTE').length;

  const getClienteLabel = (r: RdvPro) =>
    r.cliente ? `${r.cliente.prenom} ${r.cliente.nom}` : (r.walkInNom || 'Client présentiel');
  const getInitiales = (r: RdvPro) =>
    r.cliente
      ? `${r.cliente.prenom[0]}${r.cliente.nom[0]}`
      : ((r.walkInNom?.slice(0, 2) || 'WI').toUpperCase());

  const toggleWiService = (id: string) =>
    setWiServices((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const submitWalkIn = async () => {
    if (!wiNom.trim()) { setWiErr('Le nom du client est requis.'); return; }
    if (!wiDate || !wiTime) { setWiErr('La date et l\'heure sont requises.'); return; }
    if (wiServices.length === 0) { setWiErr('Sélectionnez au moins un service.'); return; }
    setWiLoading(true); setWiErr(null);
    try {
      await api.post('/rendez-vous/presentiel', {
        walkInNom: wiNom.trim(),
        walkInTelephone: wiTel.trim() || undefined,
        dateHeure: new Date(`${wiDate}T${wiTime}`).toISOString(),
        serviceIds: wiServices,
        note: wiNote.trim() || undefined,
      });
      setWiOk('Rendez-vous présentiel enregistré avec succès !');
      setWiNom(''); setWiTel(''); setWiDate(''); setWiTime('');
      setWiServices([]); setWiNote('');
      loadRDV();
      setTimeout(() => setWiOk(null), 4000);
    } catch (err) {
      setWiErr((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur lors de l\'enregistrement.');
    } finally {
      setWiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold">Espace professionnel</h1>
          <p className="text-purple-100 mt-1">
            Bienvenue {user?.prenom} — Gérez votre planning et vos clientes
          </p>
          <div className="flex gap-4 mt-4">
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <p className="text-2xl font-bold">{todayRdv.length}</p>
              <p className="text-xs text-white/80">RDV aujourd&apos;hui</p>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-white/80">En attente</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm mb-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                tab === t.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <>
          {/* Agenda */}
          {tab === 'agenda' && (
            <div>
              {/* Week navigator */}
              <div className="flex items-center justify-between mb-6">
                <button
                  aria-label="Semaine précédente"
                  onClick={() => setWeekStart((d) => addDays(d, -7))}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h2 className="font-bold text-gray-900">
                  Semaine du {format(weekStart, 'd MMMM', { locale: fr })}
                </h2>
                <button
                  aria-label="Semaine suivante"
                  onClick={() => setWeekStart((d) => addDays(d, 7))}
                  className="p-2 rounded-lg hover:bg-gray-100"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Week grid */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {weekDays.map((day) => {
                  const dayRdv = getRdvForDay(day);
                  const today = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`bg-white rounded-xl border p-3 min-h-[180px] ${
                        today ? 'border-pink-300 ring-2 ring-pink-100' : 'border-gray-200'
                      }`}
                    >
                      <div className="text-center mb-3">
                        <p className="text-xs text-gray-400 uppercase">
                          {format(day, 'EEE', { locale: fr })}
                        </p>
                        <p className={`text-lg font-bold ${today ? 'text-pink-600' : 'text-gray-700'}`}>
                          {format(day, 'd')}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {dayRdv.length === 0 && (
                          <p className="text-xs text-gray-300 text-center">—</p>
                        )}
                        {dayRdv.map((r) => (
                          <div key={r.id} className={`text-xs p-2 rounded-lg border ${statutColors[r.statut]}`}>
                            <p className="font-bold">{format(new Date(r.dateHeure), 'HH:mm')}</p>
                            <p className="truncate">{getClienteLabel(r)}</p>
                            <p className="truncate opacity-70">
                              {r.services.map((s) => s.service.nom).join(', ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Today's detailed list */}
              <div className="mt-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Rendez-vous du jour ({todayRdv.length})
                </h3>
                {todayRdv.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center text-gray-400">
                    Aucun rendez-vous aujourd&apos;hui
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayRdv.map((r) => (
                      <div key={r.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {getInitiales(r)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {getClienteLabel(r)}
                                  {r.typeRdv === 'PRESENTIEL' && (
                                    <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Présentiel</span>
                                  )}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {format(new Date(r.dateHeure), 'HH:mm')} · {r.dureeEstimee ?? '–'} min
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2 ml-[52px]">
                              {r.services.map((s, i) => (
                                <span key={i} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                                  {s.service.nom}
                                </span>
                              ))}
                            </div>
                            {r.notes && (
                              <p className="text-sm text-gray-400 mt-2 ml-[52px] italic">
                                &ldquo;{r.notes}&rdquo;
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statutColors[r.statut]}`}>
                              {statutLabels[r.statut]}
                            </span>
                            <div className="flex gap-1.5">
                              {r.statut === 'EN_ATTENTE' && (
                                <>
                                  <button onClick={() => handleStatut(r.id, 'CONFIRME')} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100" title="Confirmer">
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleStatut(r.id, 'ANNULE')} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" title="Refuser">
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {r.statut === 'CONFIRME' && (
                                <button onClick={() => handleStatut(r.id, 'EN_COURS')} className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-100">
                                  Démarrer
                                </button>
                              )}
                              {r.statut === 'EN_COURS' && (
                                <>
                                  <button onClick={() => handleStatut(r.id, 'TERMINE')} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100">
                                    Terminer
                                  </button>
                                  <button onClick={() => openSaisie(r.id)} className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-100 flex items-center gap-1">
                                    <Package className="h-3 w-3" /> Matières
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Présentiel tab */}
          {tab === 'presentiel' && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Client présentiel</h2>
                    <p className="text-sm text-gray-500">Enregistrer un client arrivé directement au salon</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom du client <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={wiNom}
                      onChange={(e) => setWiNom(e.target.value)}
                      placeholder="Ex: Marie Dupont"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Téléphone (optionnel)
                    </label>
                    <input
                      type="tel"
                      value={wiTel}
                      onChange={(e) => setWiTel(e.target.value)}
                      placeholder="Ex: 06 12 34 56 78"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        aria-label="Date"
                        type="date"
                        value={wiDate}
                        onChange={(e) => setWiDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Heure <span className="text-red-500">*</span>
                      </label>
                      <input
                        aria-label="Heure"
                        type="time"
                        value={wiTime}
                        onChange={(e) => setWiTime(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Services <span className="text-red-500">*</span>
                    </label>
                    {servicesDispos.length === 0 ? (
                      <p className="text-sm text-gray-400">Chargement des services…</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                        {servicesDispos.map((s) => (
                          <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={wiServices.includes(s.id)}
                              onChange={() => toggleWiService(s.id)}
                              className="accent-purple-600"
                            />
                            <span className="flex-1 text-sm text-gray-700">{s.nom}</span>
                            <span className="text-xs text-gray-400">{s.duree} min · {s.prix} dt</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Note (optionnel)
                    </label>
                    <textarea
                      value={wiNote}
                      onChange={(e) => setWiNote(e.target.value)}
                      rows={2}
                      placeholder="Demandes spéciales, informations…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none resize-none"
                    />
                  </div>

                  {wiOk && (
                    <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
                      {wiOk}
                    </div>
                  )}
                  {wiErr && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
                      {wiErr}
                    </div>
                  )}

                  <button
                    onClick={submitWalkIn}
                    disabled={wiLoading}
                    className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {wiLoading ? 'Enregistrement…' : 'Enregistrer le rendez-vous'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Clients tab */}
          {tab === 'clients' && (
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Mes clientes régulières</h2>
              {clientesLoading ? (
                <p className="text-gray-400 text-center py-8">Chargement…</p>
              ) : mesClientes.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  La liste de vos clientes apparaîtra ici au fur et à mesure de vos rendez-vous.
                </p>
              ) : (
                <div className="space-y-3">
                  {mesClientes.map((c) => (
                    <div key={c.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-4 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                          {c.prenom[0]}{c.nom[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{c.prenom} {c.nom}</p>
                          <p className="text-xs text-gray-400">
                            {c.telephone || 'Pas de téléphone'} · Dernière visite : {format(new Date(c.derniereVisite), 'dd/MM/yyyy', { locale: fr })}
                          </p>
                          {c.services.length > 0 && (
                            <p className="text-xs text-purple-500 mt-0.5">{c.services.join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-600 text-xs font-medium px-2.5 py-1 rounded-full">
                          {c.nombreVisites} visite{c.nombreVisites > 1 ? 's' : ''}
                        </span>
                        {c.profilCapillaire && (
                          <p className="text-xs text-gray-400 mt-1 max-w-[140px] truncate">{c.profilCapillaire}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Matières utilisées tab */}
          {tab === 'matieres' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Saisie des matières pour un RDV</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Cliquez sur le bouton <strong>Matières</strong> d&apos;un rendez-vous en cours pour enregistrer les produits utilisés, ou sélectionnez un RDV ci-dessous.
                </p>
                <select
                  aria-label="Sélectionner un rendez-vous"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
                  value={saisieRdvId || ''}
                  onChange={(e) => e.target.value && openSaisie(e.target.value)}
                >
                  <option value="">— Sélectionner un rendez-vous —</option>
                  {rdvList.filter((r) => r.statut === 'EN_COURS' || r.statut === 'TERMINE').map((r) => (
                    <option key={r.id} value={r.id}>
                      {format(new Date(r.dateHeure), 'dd/MM HH:mm')} — {getClienteLabel(r)} ({statutLabels[r.statut]})
                    </option>
                  ))}
                </select>
              </div>

              {saisieRdvId && (
                <div className="bg-white rounded-xl p-6 border border-purple-100 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">Produits utilisés</h3>
                  <div className="space-y-3">
                    {lignes.map((ln, i) => (
                      <div key={i} className="flex gap-3 items-center">
                        <select
                          aria-label="Produit"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          value={ln.produitId}
                          onChange={(e) => updateLigne(i, 'produitId', e.target.value)}
                        >
                          <option value="">— Produit —</option>
                          {produitsDispos.map((p) => (
                            <option key={p.id} value={p.id}>{p.nom} ({p.unite})</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          placeholder="Qté"
                          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          value={ln.quantite}
                          onChange={(e) => updateLigne(i, 'quantite', e.target.value)}
                        />
                        {lignes.length > 1 && (
                          <button aria-label="Supprimer cette ligne" onClick={() => removeLigne(i)} className="text-red-400 hover:text-red-600">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={addLigne} className="mt-3 text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1">
                    <Plus className="h-4 w-4" /> Ajouter un produit
                  </button>
                  {saisieOk && <p className="mt-3 text-sm text-green-600">{saisieOk}</p>}
                  {saisieErr && <p className="mt-3 text-sm text-red-500">{saisieErr}</p>}
                  <div className="flex gap-3 mt-4">
                    <button onClick={submitSaisie} className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                      Enregistrer
                    </button>
                    <button onClick={() => setSaisieRdvId(null)} className="border border-gray-200 text-gray-600 px-5 py-2 rounded-lg text-sm hover:bg-gray-50">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Portfolio tab */}
          {tab === 'portfolio' && (
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Mon portfolio</h2>
              <p className="text-gray-400 text-center py-8">
                Ajoutez vos plus belles réalisations pour attirer de nouvelles clientes.
                <br />
                <span className="text-sm">(Fonctionnalité bientôt disponible)</span>
              </p>
            </div>
          )}
        </>
      </div>
    </div>
  );
}
