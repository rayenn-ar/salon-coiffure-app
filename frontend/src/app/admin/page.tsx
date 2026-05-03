'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Users,
  Calendar,
  Package,
  DollarSign,
  TrendingUp,
  UserPlus,
  AlertTriangle,
  Scissors,
  ShoppingBag,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  FlaskConical,
  X,
  Settings,
  Eye,
  EyeOff,
  Wallet,
  Ban,
  CreditCard,
} from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import api from '../../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface DashboardData {
  rdvAujourdhui: number;
  rdvSemaine: number;
  totalClientes: number;
  totalCoiffeuses: number;
  chiffreAffairesMois: number;
  caAujourdhui: number;
  rdvEnAttente: number;
  alertesStock: number;
  totalDepensesMois: number;
  revenuNetMois: number;
  depensesDues: { id: string; label: string; montant: number; type: string; dateDepense: string; coiffeuse?: { prenom: string; nom: string } | null }[];
}

interface Produit {
  id: string;
  nom: string;
  marque: string | null;
  description?: string | null;
  quantiteStock: number;
  quantiteAlerte: number;
  unite: string;
  categorie: string;
  consommations?: { quantite: number; service: { id: string; nom: string } }[];
}

interface Ingredient {
  id: string;
  serviceId: string;
  produitId: string;
  quantite: number;
  produit: {
    id: string;
    nom: string;
    unite: string;
    quantiteStock: number;
    quantiteAlerte: number;
    categorie: string;
  };
}

interface MouvementStock {
  id: string;
  createdAt: string;
  quantite: number;
  produit: { nom: string; unite: string; marque?: string | null };
  coiffeuse?: { prenom: string; nom: string } | null;
  rendezVous?: { id: string; dateHeure: string; cliente?: { prenom: string; nom: string } | null } | null;
}

interface CoiffeuseStat {
  id: string;
  prenom: string;
  nom: string;
  nbRdv: number;
  ca: number;
  noteMoyenne: string | null;
}

interface Coiffeuse {
  id: string;
  nom: string;
  prenom: string;
  niveau: string;
  actif: boolean;
  specialites: string[];
  salaire?: number | null;
  bio?: string;
  user?: { email: string; actif: boolean };
}

interface GraphiqueData {
  rdvParJour: { label: string; rdv: number; ca: number }[];
  caParMois: { mois: string; ca: number }[];
  rdvParStatut: { statut: string; count: number }[];
}

interface Depense {
  id: string;
  label: string;
  montant: number;
  type: string;
  coiffeuseId: string | null;
  mois: number;
  annee: number;
  dateDepense: string;
  payee: boolean;
  notes: string | null;
  createdAt: string;
  coiffeuse?: { id: string; nom: string; prenom: string; salaire?: number | null } | null;
}

interface DepensesData {
  depenses: Depense[];
  total: number;
  totalParType: Record<string, number>;
  resumeCoiffeuses: { prenom: string; nom: string; salaire: number | null; totalDepenses: number; avances: number; net: number }[];
}

interface RDV {
  id: string;
  dateHeure: string;
  statut: string;
  prixTotal: number;
  coiffeuse: { id: string; nom: string; prenom: string };
  cliente: { id: string; nom: string; prenom: string; telephone: string } | null;
  walkInNom?: string | null;
  walkInTelephone?: string | null;
  services: { service: { nom: string } }[];
}

interface Service {
  id: string;
  nom: string;
  categorie: string;
  prixBase: number;
  dureeMinutes: number;
  actif: boolean;
  description?: string;
}

interface Cliente {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  typeCheveux?: string;
  user: { email: string; createdAt: string };
  _count: { rendezVous: number };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
  { id: 'rdv', label: 'Rendez-vous', icon: Calendar },
  { id: 'services', label: 'Services', icon: Scissors },
  { id: 'coiffeuses', label: 'Coiffeuses', icon: Users },
  { id: 'clients', label: 'Clientes', icon: ShoppingBag },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'depenses', label: 'Dépenses', icon: Wallet },
  { id: 'parametres', label: 'Paramètres', icon: Settings },
];

const STATUTS_RDV = ['EN_ATTENTE', 'CONFIRME', 'EN_COURS', 'TERMINE', 'ANNULE_CLIENT', 'ANNULE_SALON', 'NO_SHOW'];
const CATEGORIES_SERVICE = ['COUPE', 'COLORATION', 'SOIN', 'COIFFAGE_EVENEMENT', 'EXTENSION', 'FORFAIT'];
const UNITES_PREDEFINIES = ['ml', 'g', 'kg', 'L', 'pcs', 'tube', 'flacon', 'sachet', 'boite'];
const TYPES_DEPENSE = ['SALAIRE', 'AVANCE', 'CHARGE', 'AUTRE'];

const statutColor: Record<string, string> = {
  EN_ATTENTE: 'bg-yellow-100 text-yellow-700',
  CONFIRME: 'bg-blue-100 text-blue-700',
  EN_COURS: 'bg-purple-100 text-purple-700',
  TERMINE: 'bg-green-100 text-green-700',
  ANNULE_CLIENT: 'bg-red-100 text-red-700',
  ANNULE_SALON: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-gray-100 text-gray-700',
};

const niveauColor: Record<string, string> = {
  JUNIOR: 'bg-blue-100 text-blue-700',
  CONFIRMEE: 'bg-green-100 text-green-700',
  SENIOR: 'bg-purple-100 text-purple-700',
  EXPERT: 'bg-yellow-100 text-yellow-700',
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, token, _hasHydrated } = useAuthStore();
  const [tab, setTab] = useState('dashboard');

  // Data
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [stats, setStats] = useState<CoiffeuseStat[]>([]);
  const [coiffeuses, setCoiffeuses] = useState<Coiffeuse[]>([]);
  const [rdvs, setRdvs] = useState<RDV[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Filters
  const [rdvFilter, setRdvFilter] = useState('');
  const [rdvDateFilter, setRdvDateFilter] = useState('');

  // Add coiffeuse form
  const [showAddCoiffeuse, setShowAddCoiffeuse] = useState(false);
  const [newCoiffeuse, setNewCoiffeuse] = useState({ nom: '', prenom: '', email: '', password: '', specialites: '', niveau: 'CONFIRMEE' });
  const [coiffeureError, setCoiffeureError] = useState('');

  // Add/Edit service form
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState({ nom: '', categorie: 'COUPE', prixBase: '', dureeMinutes: '', description: '' });
  const [serviceError, setServiceError] = useState('');

  // Add product form
  const [showAddProduit, setShowAddProduit] = useState(false);
  const [newProduit, setNewProduit] = useState({ nom: '', marque: '', description: '', categorie: '', unite: '', uniteCustom: '', quantiteStock: 0, quantiteAlerte: 5, prixAchat: 0 });

  // Ingredient management
  const [ingModal, setIngModal] = useState<Service | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loadingIng, setLoadingIng] = useState(false);
  const [ingForm, setIngForm] = useState({ produitId: '', quantite: '' });
  const [ingError, setIngError] = useState('');

  // Graphique stats
  const [graphique, setGraphique] = useState<GraphiqueData | null>(null);

  // Edit produit modal
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [editProduitForm, setEditProduitForm] = useState({ nom: '', marque: '', description: '', categorie: '', unite: '', uniteCustom: '', quantiteAlerte: 0, prixAchatUnite: '' });

  // Stock mouvements
  const [showMouvements, setShowMouvements] = useState(false);
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [mouvementsLoading, setMouvementsLoading] = useState(false);

  // Edit coiffeuse modal
  const [editingCoiffeuse, setEditingCoiffeuse] = useState<Coiffeuse | null>(null);
  const [editCoiffeuseForm, setEditCoiffeuseForm] = useState({ bio: '', specialites: '', niveau: 'CONFIRMEE', salaire: '' });

  // Depenses
  const [depensesData, setDepensesData] = useState<DepensesData | null>(null);
  const [depenseMois, setDepenseMois] = useState(new Date().getMonth() + 1);
  const [depenseAnnee, setDepenseAnnee] = useState(new Date().getFullYear());
  const [showAddDepense, setShowAddDepense] = useState(false);
  const [newDepense, setNewDepense] = useState({ label: '', montant: '', type: 'AUTRE', coiffeuseId: '', notes: '', dateDepense: new Date().toISOString().slice(0, 10) });
  const [depenseError, setDepenseError] = useState('');

  // Coiffeuse password
  const [showCoiffeusePassword, setShowCoiffeusePassword] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    const r = await api.get('/admin/dashboard');
    setDashboard(r.data.data);
  }, []);

  const loadProduits = useCallback(async () => {
    const r = await api.get('/admin/produits');
    setProduits(r.data.data?.produits || []);
  }, []);

  const loadStats = useCallback(async () => {
    const r = await api.get('/admin/stats');
    setStats(r.data.data || []);
  }, []);

  const loadCoiffeuses = useCallback(async () => {
    const r = await api.get('/admin/coiffeuses');
    setCoiffeuses(r.data.data || []);
  }, []);

  const loadRDVs = useCallback(async () => {
    const params = new URLSearchParams();
    if (rdvFilter) params.set('statut', rdvFilter);
    if (rdvDateFilter) params.set('date', rdvDateFilter);
    const r = await api.get(`/rendez-vous?${params.toString()}`);
    setRdvs(r.data.data || []);
  }, [rdvFilter, rdvDateFilter]);

  const loadServices = useCallback(async () => {
    const r = await api.get('/services?actif=all');
    setServices(r.data.data || []);
  }, []);

  const loadClientes = useCallback(async () => {
    const r = await api.get('/admin/clients');
    setClientes(r.data.data || []);
  }, []);

  const loadGraphique = useCallback(async () => {
    const r = await api.get('/admin/stats/graphique');
    setGraphique(r.data.data || null);
  }, []);

  const loadDepenses = useCallback(async (mois: number, annee: number) => {
    const r = await api.get(`/admin/depenses?mois=${mois}&annee=${annee}`);
    setDepensesData(r.data.data || null);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      await Promise.all([loadDashboard(), loadProduits(), loadStats(), loadCoiffeuses(), loadGraphique()]);
    } catch {
      setLoadError(true);
    }
    finally { setLoading(false); }
  }, [loadDashboard, loadProduits, loadStats, loadCoiffeuses, loadGraphique]);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!token) { router.push('/connexion?redirect=/admin'); return; }
    if (user?.role !== 'ADMIN') { router.push('/'); return; }
    loadAll();
  }, [_hasHydrated, token, user, router, loadAll]);

  // Lazy load per tab
  useEffect(() => {
    if (tab === 'rdv') loadRDVs().catch(() => {});
  }, [tab, loadRDVs]);

  useEffect(() => {
    if (tab === 'services') loadServices().catch(() => {});
  }, [tab, loadServices]);

  useEffect(() => {
    if (tab === 'clients') loadClientes().catch(() => {});
  }, [tab, loadClientes]);

  useEffect(() => {
    if (tab === 'coiffeuses') loadCoiffeuses().catch(() => {});
  }, [tab, loadCoiffeuses]);

  useEffect(() => {
    if (tab === 'depenses') loadDepenses(depenseMois, depenseAnnee).catch(() => {});
  }, [tab, depenseMois, depenseAnnee, loadDepenses]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAddCoiffeuse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCoiffeureError('');
    try {
      await api.post('/admin/coiffeuses', {
        ...newCoiffeuse,
        specialites: newCoiffeuse.specialites.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setShowAddCoiffeuse(false);
      setNewCoiffeuse({ nom: '', prenom: '', email: '', password: '', specialites: '', niveau: 'CONFIRMEE' });
      loadCoiffeuses();
    } catch (err: unknown) {
      setCoiffeureError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    }
  };

  const handleDeleteCoiffeuse = async (id: string, nom: string) => {
    if (!confirm(`Désactiver définitivement ${nom} de l'équipe ?\nSes rendez-vous passés seront conservés.`)) return;
    try {
      await api.delete(`/admin/coiffeuses/${id}`);
      loadCoiffeuses();
    } catch { /* silent */ }
  };

  const handleBlockCoiffeuse = async (id: string, nom: string, isBlocked: boolean) => {
    const msg = isBlocked
      ? `Débloquer le compte de ${nom} ?`
      : `Bloquer le compte de ${nom} ?\nSes RDV futurs seront annulés.`;
    if (!confirm(msg)) return;
    try {
      await api.patch(`/admin/coiffeuses/${id}/bloquer`);
      loadCoiffeuses();
    } catch { /* silent */ }
  };

  const handleDeleteCoiffeusePermanent = async (id: string, nom: string) => {
    if (!confirm(`⚠️ SUPPRESSION DÉFINITIVE de ${nom} ?\nCette action est irréversible. Tous ses RDV futurs seront annulés et son compte sera supprimé.`)) return;
    try {
      await api.delete(`/admin/coiffeuses/${id}/permanent`);
      loadCoiffeuses();
    } catch { /* silent */ }
  };

  const openAddService = () => {
    setEditingService(null);
    setServiceForm({ nom: '', categorie: 'COUPE', prixBase: '', dureeMinutes: '', description: '' });
    setServiceError('');
    setShowServiceForm(true);
  };

  const openEditService = (s: Service) => {
    setEditingService(s);
    setServiceForm({ nom: s.nom, categorie: s.categorie, prixBase: String(s.prixBase), dureeMinutes: String(s.dureeMinutes), description: s.description || '' });
    setServiceError('');
    setShowServiceForm(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceError('');
    try {
      const payload = {
        nom: serviceForm.nom,
        categorie: serviceForm.categorie,
        prixBase: parseFloat(serviceForm.prixBase),
        dureeMinutes: parseInt(serviceForm.dureeMinutes),
        description: serviceForm.description,
      };
      if (editingService) {
        await api.put(`/services/${editingService.id}`, payload);
      } else {
        await api.post('/services', payload);
      }
      setShowServiceForm(false);
      loadServices();
    } catch (err: unknown) {
      setServiceError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    }
  };

  const handleToggleService = async (id: string, actif: boolean) => {
    try {
      await api.put(`/services/${id}`, { actif: !actif });
      loadServices();
    } catch { /* silent */ }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Supprimer ce service ?')) return;
    try {
      await api.delete(`/services/${id}`);
      loadServices();
    } catch { /* silent */ }
  };

  const handleUpdateStatutRDV = async (id: string, statut: string) => {
    try {
      await api.patch(`/rendez-vous/${id}/statut`, { statut });
      loadRDVs();
    } catch { /* silent */ }
  };

  const handleAddProduit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const uniteFinale = newProduit.unite === 'autre' ? newProduit.uniteCustom : newProduit.unite;
      await api.post('/admin/produits', {
        nom: newProduit.nom,
        marque: newProduit.marque || undefined,
        description: newProduit.description || undefined,
        categorie: newProduit.categorie,
        unite: uniteFinale,
        quantiteStock: newProduit.quantiteStock,
        quantiteAlerte: newProduit.quantiteAlerte,
        prixAchatUnite: newProduit.prixAchat || undefined,
      });
      setShowAddProduit(false);
      setNewProduit({ nom: '', marque: '', description: '', categorie: '', unite: '', uniteCustom: '', quantiteStock: 0, quantiteAlerte: 5, prixAchat: 0 });
      loadProduits();
    } catch { /* silent */ }
  };

  const handleUpdateStock = async (id: string, quantite: number, operation: 'add' | 'set') => {
    try {
      await api.patch(`/admin/produits/${id}/stock`, { quantite, operation });
      loadProduits();
    } catch { /* silent */ }
  };

  const loadMouvements = async () => {
    setMouvementsLoading(true);
    try {
      const res = await api.get('/admin/stock/mouvements?limit=50');
      setMouvements(res.data.data || []);
    } catch { /* silent */ } finally {
      setMouvementsLoading(false);
    }
  };

  const openEditProduit = (p: Produit) => {
    setEditingProduit(p);
    setEditProduitForm({
      nom: p.nom ?? '',
      marque: p.marque ?? '',
      description: p.description ?? '',
      categorie: p.categorie ?? '',
      unite: UNITES_PREDEFINIES.includes(p.unite) ? p.unite : 'autre',
      uniteCustom: UNITES_PREDEFINIES.includes(p.unite) ? '' : p.unite,
      quantiteAlerte: p.quantiteAlerte ?? 0,
      prixAchatUnite: '',
    });
  };

  const handleSaveProduit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const uniteFinale = editProduitForm.unite === 'autre' ? editProduitForm.uniteCustom : editProduitForm.unite;
      await api.patch(`/admin/produits/${editingProduit!.id}`, {
        ...editProduitForm,
        unite: uniteFinale,
        prixAchatUnite: editProduitForm.prixAchatUnite ? parseFloat(editProduitForm.prixAchatUnite) : undefined,
      });
      setEditingProduit(null);
      loadProduits();
    } catch { /* silent */ }
  };

  const openEditCoiffeuse = (c: Coiffeuse) => {
    setEditingCoiffeuse(c);
    setEditCoiffeuseForm({
      bio: c.bio || '',
      specialites: c.specialites.join(', '),
      niveau: c.niveau,
      salaire: c.salaire != null ? String(c.salaire) : '',
    });
  };

  const handleSaveCoiffeuse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/coiffeuses/${editingCoiffeuse!.id}`, {
        bio: editCoiffeuseForm.bio,
        specialites: editCoiffeuseForm.specialites.split(',').map((s) => s.trim()).filter(Boolean),
        niveau: editCoiffeuseForm.niveau,
      });
      // Update salary separately
      if (editCoiffeuseForm.salaire !== '') {
        await api.patch(`/admin/coiffeuses/${editingCoiffeuse!.id}/salaire`, {
          salaire: parseFloat(editCoiffeuseForm.salaire) || null,
        });
      }
      setEditingCoiffeuse(null);
      loadCoiffeuses();
    } catch { /* silent */ }
  };

  const handleAddDepense = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepenseError('');
    try {
      await api.post('/admin/depenses', {
        ...newDepense,
        montant: parseFloat(newDepense.montant),
        mois: depenseMois,
        annee: depenseAnnee,
        coiffeuseId: newDepense.coiffeuseId || undefined,
      });
      setShowAddDepense(false);
      setNewDepense({ label: '', montant: '', type: 'AUTRE', coiffeuseId: '', notes: '', dateDepense: new Date().toISOString().slice(0, 10) });
      loadDepenses(depenseMois, depenseAnnee);
      loadDashboard();
    } catch (err: unknown) {
      setDepenseError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    }
  };

  const handleDeleteDepense = async (id: string) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    try {
      await api.delete(`/admin/depenses/${id}`);
      loadDepenses(depenseMois, depenseAnnee);
      loadDashboard();
    } catch { /* silent */ }
  };

  const handlePayerDepense = async (id: string) => {
    try {
      await api.patch(`/admin/depenses/${id}/payer`);
      loadDepenses(depenseMois, depenseAnnee);
      loadDashboard();
    } catch { /* silent */ }
  };

  const openIngModal = (s: Service) => {
    setIngModal(s);
    setIngForm({ produitId: '', quantite: '' });
    setIngError('');
    setIngredients([]);
    setLoadingIng(true);
    api.get(`/admin/services/${s.id}/ingredients`)
      .then((r) => setIngredients(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingIng(false));
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngError('');
    try {
      await api.put(`/admin/services/${ingModal!.id}/ingredients`, {
        produitId: ingForm.produitId,
        quantite: parseFloat(ingForm.quantite),
      });
      const r = await api.get(`/admin/services/${ingModal!.id}/ingredients`);
      setIngredients(r.data.data || []);
      setIngForm({ produitId: '', quantite: '' });
    } catch (err: unknown) {
      setIngError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur');
    }
  };

  const handleDeleteIngredient = async (produitId: string) => {
    try {
      await api.delete(`/admin/services/${ingModal!.id}/ingredients/${produitId}`);
      setIngredients((prev) => prev.filter((i) => i.produitId !== produitId));
    } catch { /* silent */ }
  };

  if (!_hasHydrated || loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Chargement…</div>
    </div>
  );
  if (!token || user?.role !== 'ADMIN') return null;

  const alertProduits = produits.filter((p) => p.quantiteStock <= p.quantiteAlerte);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold">Administration</h1>
          <p className="text-gray-300 mt-1">Gestion complète du salon</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 bg-white rounded-xl p-1 shadow-sm mb-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center min-w-[100px] ${
                tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Chargement...</div>
        ) : loadError ? (
          <div className="text-center py-16">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Impossible de charger les données</p>
            <p className="text-gray-400 text-sm mt-1">Vérifiez votre connexion et rechargez la page</p>
            <button onClick={loadAll} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700">
              Réessayer
            </button>
          </div>
        ) : (
          <>
            {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
            {tab === 'dashboard' && (
              !dashboard ? (
                <div className="text-center py-16 text-gray-400">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Données du tableau de bord indisponibles</p>
                </div>
              ) : (
              <div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: "RDV aujourd'hui", value: dashboard.rdvAujourdhui, icon: Calendar, color: 'from-pink-500 to-rose-500' },
                    { label: 'RDV cette semaine', value: dashboard.rdvSemaine, icon: TrendingUp, color: 'from-purple-500 to-indigo-500' },
                    { label: 'En attente conf.', value: dashboard.rdvEnAttente, icon: Clock, color: 'from-yellow-500 to-orange-500' },
                    { label: 'Total clientes', value: dashboard.totalClientes, icon: Users, color: 'from-blue-500 to-cyan-500' },
                    { label: 'Coiffeuses actives', value: dashboard.totalCoiffeuses, icon: Scissors, color: 'from-violet-500 to-purple-500' },
                    { label: "CA aujourd'hui", value: `${Number(dashboard.caAujourdhui).toFixed(0)} dt`, icon: DollarSign, color: 'from-teal-500 to-green-500' },
                    { label: 'CA du mois', value: `${Number(dashboard.chiffreAffairesMois).toFixed(0)} dt`, icon: DollarSign, color: 'from-green-500 to-emerald-500' },
                    { label: 'Dépenses du mois', value: `${Number(dashboard.totalDepensesMois).toFixed(0)} dt`, icon: Wallet, color: 'from-orange-500 to-red-500' },
                    { label: 'Revenu net du mois', value: `${Number(dashboard.revenuNetMois).toFixed(0)} dt`, icon: TrendingUp, color: dashboard.revenuNetMois >= 0 ? 'from-emerald-500 to-teal-600' : 'from-red-500 to-rose-600' },
                    { label: 'Alertes stock', value: dashboard.alertesStock, icon: AlertTriangle, color: dashboard.alertesStock > 0 ? 'from-red-500 to-rose-600' : 'from-gray-400 to-gray-500' },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">{kpi.label}</p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                        </div>
                        <div className={`w-11 h-11 bg-gradient-to-r ${kpi.color} rounded-xl flex items-center justify-center`}>
                          <kpi.icon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dépenses dues aujourd'hui */}
                {dashboard.depensesDues && dashboard.depensesDues.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
                    <h3 className="font-bold text-amber-700 flex items-center gap-2 mb-3">
                      <CreditCard className="h-5 w-5" /> Dépenses à payer ({dashboard.depensesDues.length})
                    </h3>
                    <div className="space-y-2">
                      {dashboard.depensesDues.map((d) => (
                        <div key={d.id} className="flex justify-between items-center text-sm bg-white rounded-lg px-3 py-2 border border-amber-100">
                          <div>
                            <span className="text-amber-800 font-medium">{d.label}</span>
                            {d.coiffeuse && <span className="text-amber-600 ml-1">({d.coiffeuse.prenom} {d.coiffeuse.nom})</span>}
                            <span className="text-xs text-amber-500 ml-2">
                              {new Date(d.dateDepense).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-700">{Number(d.montant).toFixed(2)} dt</span>
                            <button
                              onClick={() => handlePayerDepense(d.id)}
                              className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 font-medium"
                            >
                              ✓ Payée
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats coiffeuses */}
                {stats.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">Performance du mois</h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Coiffeuse</th>
                          <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">RDV</th>
                          <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">CA</th>
                          <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Note moy.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {stats.map((s) => (
                          <tr key={s.id}>
                            <td className="px-5 py-3 font-medium text-gray-900">{s.prenom} {s.nom}</td>
                            <td className="px-5 py-3 text-center text-gray-700">{s.nbRdv}</td>
                            <td className="px-5 py-3 text-center text-gray-700">{s.ca} dt</td>
                            <td className="px-5 py-3 text-center">
                              {s.noteMoyenne ? (
                                <span className="text-yellow-500 font-semibold">★ {s.noteMoyenne}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── GRAPHIQUES ─────────────────────────────────────────── */}
                {graphique && (
                  <div className="grid lg:grid-cols-2 gap-6 mb-6">
                    {/* RDV 7 derniers jours */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-purple-600" /> RDV — 7 derniers jours
                      </h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={graphique.rdvParJour}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="rdv" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="RDV" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* CA 6 derniers mois */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" /> CA — 6 derniers mois (dt)
                      </h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={graphique.caParMois}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(v) => [`${v ?? 0} dt`, 'CA']} />
                          <Bar dataKey="ca" fill="#10b981" radius={[4, 4, 0, 0]} name="CA" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* RDV par statut */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-pink-600" /> Répartition RDV par statut
                      </h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={graphique.rdvParStatut.filter((d) => d.count > 0)}
                            dataKey="count" nameKey="statut"
                            cx="50%" cy="50%" outerRadius={75}
                            label={(props) => { const { name, percent } = props as { name?: string; percent?: number }; return `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`; }}
                          >
                            {graphique.rdvParStatut.filter((d) => d.count > 0).map((_, i) => (
                              <Cell key={i} fill={['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#6b7280'][i % 7]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* CA par coiffeuse */}
                    {stats.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <Scissors className="h-4 w-4 text-indigo-600" /> CA par coiffeuse (mois)
                        </h3>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={stats.map((s) => ({ nom: s.prenom, ca: s.ca, rdv: s.nbRdv }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="nom" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v) => [`${v ?? 0} dt`, 'CA']} />
                            <Bar dataKey="ca" fill="#6366f1" radius={[4, 4, 0, 0]} name="CA" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

                {alertProduits.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                    <h3 className="font-bold text-red-700 flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5" /> Alertes stock ({alertProduits.length})
                    </h3>
                    <div className="space-y-1.5">
                      {alertProduits.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-sm">
                          <span className="text-red-700">{p.marque} — {p.nom}</span>
                          <span className="font-bold text-red-600">{p.quantiteStock} {p.unite} restant(s)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )
            )}

            {/* ── RENDEZ-VOUS ───────────────────────────────────────────────── */}
            {tab === 'rdv' && (
              <div>
                <div className="flex flex-wrap gap-3 mb-6">
                  <h2 className="text-lg font-bold text-gray-900 self-center mr-auto">Rendez-vous</h2>
                  <input
                    type="date"
                    title="Filtrer par date"
                    value={rdvDateFilter}
                    onChange={(e) => setRdvDateFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none"
                  />
                  <div className="relative">
                    <select
                      title="Filtrer par statut"
                      value={rdvFilter}
                      onChange={(e) => setRdvFilter(e.target.value)}
                      className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none"
                    >
                      <option value="">Tous les statuts</option>
                      {STATUTS_RDV.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                  <button
                    onClick={() => loadRDVs()}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Filtrer
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Date / Heure</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Cliente</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Coiffeuse</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Services</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Prix</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Statut</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rdvs.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-10 text-gray-400">Aucun rendez-vous</td></tr>
                      )}
                      {rdvs.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {new Date(r.dateHeure).toLocaleDateString('fr-FR')}<br />
                            <span className="text-gray-500">{new Date(r.dateHeure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-5 py-3 text-sm">
                            {r.cliente ? (
                              <>
                                <p className="font-medium text-gray-900">{r.cliente.prenom} {r.cliente.nom}</p>
                                <p className="text-gray-500">{r.cliente.telephone}</p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-gray-900">{r.walkInNom || 'Client présentiel'}</p>
                                <p className="text-gray-500">{r.walkInTelephone || '—'}</p>
                              </>
                            )}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700">{r.coiffeuse.prenom} {r.coiffeuse.nom}</td>
                          <td className="px-5 py-3 text-sm text-gray-600 max-w-[160px] truncate">
                            {r.services.map((s) => s.service.nom).join(', ')}
                          </td>
                          <td className="px-5 py-3 text-center text-sm font-medium text-gray-900">{Number(r.prixTotal).toFixed(0)} dt</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${statutColor[r.statut] || 'bg-gray-100 text-gray-600'}`}>
                              {r.statut.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <div className="relative">
                              <select
                                title="Changer le statut"
                                value={r.statut}
                                onChange={(e) => handleUpdateStatutRDV(r.id, e.target.value)}
                                className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-gray-900 outline-none"
                              >
                                {STATUTS_RDV.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                              </select>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SERVICES ──────────────────────────────────────────────────── */}
            {tab === 'services' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Services ({services.length})</h2>
                  <button
                    onClick={openAddService}
                    className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800"
                  >
                    <Plus className="h-4 w-4" /> Nouveau service
                  </button>
                </div>

                {showServiceForm && (
                  <form onSubmit={handleSaveService} className="bg-white rounded-xl p-6 border border-gray-200 mb-6 space-y-4">
                    <h3 className="font-bold text-gray-900">{editingService ? 'Modifier le service' : 'Nouveau service'}</h3>
                    {serviceError && <p className="text-red-600 text-sm">{serviceError}</p>}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        required
                        placeholder="Nom du service"
                        value={serviceForm.nom}
                        onChange={(e) => setServiceForm((p) => ({ ...p, nom: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none"
                      />
                      <select
                        title="Catégorie"
                        value={serviceForm.categorie}
                        onChange={(e) => setServiceForm((p) => ({ ...p, categorie: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none"
                      >
                        {CATEGORIES_SERVICE.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                      </select>
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Prix (dt)"
                        value={serviceForm.prixBase}
                        onChange={(e) => setServiceForm((p) => ({ ...p, prixBase: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none"
                      />
                      <input
                        required
                        type="number"
                        min="15"
                        step="15"
                        placeholder="Durée (min)"
                        value={serviceForm.dureeMinutes}
                        onChange={(e) => setServiceForm((p) => ({ ...p, dureeMinutes: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none"
                      />
                    </div>
                    <textarea
                      placeholder="Description (optionnel)"
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm((p) => ({ ...p, description: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium">
                        Enregistrer
                      </button>
                      <button type="button" onClick={() => setShowServiceForm(false)} className="text-gray-500 px-5 py-2 rounded-lg text-sm">
                        Annuler
                      </button>
                    </div>
                  </form>
                )}

                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Service</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Catégorie</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Prix</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Durée</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Ingrédients</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Actif</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {services.map((s) => (
                        <tr key={s.id} className={!s.actif ? 'opacity-50' : ''}>
                          <td className="px-5 py-3 font-medium text-gray-900">{s.nom}</td>
                          <td className="px-5 py-3 text-sm text-gray-500">{s.categorie.replace('_', ' ')}</td>
                          <td className="px-5 py-3 text-center text-gray-700">{Number(s.prixBase).toFixed(0)} dt</td>
                          <td className="px-5 py-3 text-center text-gray-700">{s.dureeMinutes} min</td>
                          <td className="px-5 py-3 text-center">
                            <button
                              onClick={() => openIngModal(s)}
                              className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 px-2.5 py-1 rounded-lg font-medium transition"
                              title="Gérer les ingrédients"
                            >
                              <FlaskConical className="h-3.5 w-3.5" /> Gérer
                            </button>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <button onClick={() => handleToggleService(s.id, s.actif)} title="Activer/Désactiver">
                              {s.actif
                                ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                                : <XCircle className="h-5 w-5 text-gray-400 mx-auto" />}
                            </button>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEditService(s)} className="text-blue-600 hover:text-blue-800" title="Modifier">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDeleteService(s.id)} className="text-red-500 hover:text-red-700" title="Supprimer">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {services.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-10 text-gray-400">Aucun service</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── COIFFEUSES ────────────────────────────────────────────────── */}
            {tab === 'coiffeuses' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Équipe ({coiffeuses.length})</h2>
                  <button
                    onClick={() => setShowAddCoiffeuse(!showAddCoiffeuse)}
                    className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800"
                  >
                    <UserPlus className="h-4 w-4" /> Ajouter
                  </button>
                </div>

                {showAddCoiffeuse && (
                  <form onSubmit={handleAddCoiffeuse} className="bg-white rounded-xl p-6 border border-gray-200 mb-6 space-y-4">
                    <h3 className="font-bold text-gray-900">Nouvelle coiffeuse</h3>
                    {coiffeureError && <p className="text-red-600 text-sm">{coiffeureError}</p>}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input required placeholder="Prénom" value={newCoiffeuse.prenom}
                        onChange={(e) => setNewCoiffeuse((p) => ({ ...p, prenom: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <input required placeholder="Nom" value={newCoiffeuse.nom}
                        onChange={(e) => setNewCoiffeuse((p) => ({ ...p, nom: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <input required type="email" placeholder="Email" value={newCoiffeuse.email}
                        onChange={(e) => setNewCoiffeuse((p) => ({ ...p, email: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <div className="relative">
                        <input required type={showCoiffeusePassword ? 'text' : 'password'} placeholder="Mot de passe (min 12 car.)" value={newCoiffeuse.password}
                          onChange={(e) => setNewCoiffeuse((p) => ({ ...p, password: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-gray-900 outline-none" />
                        <button type="button" onClick={() => setShowCoiffeusePassword(!showCoiffeusePassword)}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                          {showCoiffeusePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <select title="Niveau" value={newCoiffeuse.niveau}
                        onChange={(e) => setNewCoiffeuse((p) => ({ ...p, niveau: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none">
                        <option value="JUNIOR">Junior</option>
                        <option value="CONFIRMEE">Confirmée</option>
                        <option value="SENIOR">Senior</option>
                        <option value="EXPERT">Experte</option>
                      </select>
                      <input placeholder="Spécialités (virgule)" value={newCoiffeuse.specialites}
                        onChange={(e) => setNewCoiffeuse((p) => ({ ...p, specialites: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium">Enregistrer</button>
                      <button type="button" onClick={() => setShowAddCoiffeuse(false)} className="text-gray-500 px-5 py-2 rounded-lg text-sm">Annuler</button>
                    </div>
                  </form>
                )}

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {coiffeuses.map((c) => {
                    const isBlocked = c.user?.actif === false;
                    return (
                    <div key={c.id} className={`bg-white rounded-xl p-5 border shadow-sm ${isBlocked ? 'opacity-60 border-red-200' : !c.actif ? 'opacity-60' : 'border-gray-100'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {c.prenom[0]}{c.nom[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{c.prenom} {c.nom}</p>
                          <p className="text-xs text-gray-500 truncate">{c.user?.email}</p>
                          {c.salaire != null && (
                            <p className="text-xs text-green-600 font-medium">Salaire: {Number(c.salaire).toFixed(0)} dt</p>
                          )}
                        </div>
                      </div>
                      {isBlocked && (
                        <div className="bg-red-50 text-red-700 text-xs px-2 py-1 rounded-lg mb-2 flex items-center gap-1">
                          <Ban className="h-3 w-3" /> Compte bloqué
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${niveauColor[c.niveau] || 'bg-gray-100 text-gray-600'}`}>
                          {c.niveau}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditCoiffeuse(c)}
                            className="text-xs px-2 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="Modifier">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleBlockCoiffeuse(c.id, `${c.prenom} ${c.nom}`, isBlocked)}
                            className={`text-xs px-2 py-1.5 rounded-lg ${isBlocked ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}
                            title={isBlocked ? 'Débloquer' : 'Bloquer'}>
                            {isBlocked ? <CheckCircle className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => handleDeleteCoiffeuse(c.id, `${c.prenom} ${c.nom}`)}
                            className="text-xs px-2 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100" title="Désactiver">
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDeleteCoiffeusePermanent(c.id, `${c.prenom} ${c.nom}`)}
                            className="text-xs px-2 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" title="Supprimer définitivement">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {c.specialites.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {c.specialites.slice(0, 3).map((s, i) => (
                            <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── CLIENTES ──────────────────────────────────────────────────── */}
            {tab === 'clients' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-6">Clientes ({clientes.length})</h2>
                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Cliente</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Email</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Téléphone</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Type cheveux</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">RDV</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Inscrite le</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {clientes.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-10 text-gray-400">Aucune cliente</td></tr>
                      )}
                      {clientes.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-900">{c.prenom} {c.nom}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">{c.user?.email}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">{c.telephone || '—'}</td>
                          <td className="px-5 py-3 text-sm text-gray-600">{c.typeCheveux?.replace('_', ' ') || '—'}</td>
                          <td className="px-5 py-3 text-center">
                            <span className="text-sm font-semibold text-gray-900">{c._count.rendezVous}</span>
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-500">
                            {new Date(c.user?.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── STOCK ─────────────────────────────────────────────────────── */}
            {tab === 'stock' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Produits ({produits.length})</h2>
                  <button
                    onClick={() => setShowAddProduit(!showAddProduit)}
                    className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800"
                  >
                    <Package className="h-4 w-4" /> Ajouter
                  </button>
                </div>

                {showAddProduit && (
                  <form onSubmit={handleAddProduit} className="bg-white rounded-xl p-6 border border-gray-200 mb-6 space-y-4">
                    <h3 className="font-bold text-gray-900">Nouveau produit</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <input required placeholder="Nom du produit" value={newProduit.nom}
                        onChange={(e) => setNewProduit((p) => ({ ...p, nom: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <input placeholder="Marque" value={newProduit.marque}
                        onChange={(e) => setNewProduit((p) => ({ ...p, marque: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <input required placeholder="Catégorie" value={newProduit.categorie}
                        onChange={(e) => setNewProduit((p) => ({ ...p, categorie: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <div className="sm:col-span-2 lg:col-span-3">
                        <select required title="Unité" value={newProduit.unite}
                          onChange={(e) => setNewProduit((p) => ({ ...p, unite: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none">
                          <option value="">-- Sélectionner une unité --</option>
                          {UNITES_PREDEFINIES.map((u) => <option key={u} value={u}>{u}</option>)}
                          <option value="autre">Autre unité personnalisée…</option>
                        </select>
                      </div>
                      {newProduit.unite === 'autre' && (
                        <input required placeholder="Saisir l'unité" value={newProduit.uniteCustom}
                          onChange={(e) => setNewProduit((p) => ({ ...p, uniteCustom: e.target.value }))}
                          className="sm:col-span-2 lg:col-span-3 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      )}
                      <textarea placeholder="Description (optionnel)" value={newProduit.description}
                        onChange={(e) => setNewProduit((p) => ({ ...p, description: e.target.value }))}
                        rows={2}
                        className="sm:col-span-2 lg:col-span-3 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none resize-none" />
                      <input type="number" min="0" placeholder="Quantité" value={newProduit.quantiteStock || ''}
                        onChange={(e) => setNewProduit((p) => ({ ...p, quantiteStock: parseInt(e.target.value) || 0 }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <input type="number" min="0" placeholder="Seuil alerte" value={newProduit.quantiteAlerte || ''}
                        onChange={(e) => setNewProduit((p) => ({ ...p, quantiteAlerte: parseInt(e.target.value) || 5 }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <input type="number" step="0.01" min="0" placeholder="Prix d'achat (dt)" value={newProduit.prixAchat || ''}
                        onChange={(e) => setNewProduit((p) => ({ ...p, prixAchat: parseFloat(e.target.value) || 0 }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium">Enregistrer</button>
                      <button type="button" onClick={() => setShowAddProduit(false)} className="text-gray-500 px-5 py-2 rounded-lg text-sm">Annuler</button>
                    </div>
                  </form>
                )}

                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Produit</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Marque</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Catégorie</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Stock</th>
                        <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Alerte</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Utilisé par</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {produits.map((p) => {
                        const isAlert = p.quantiteStock <= p.quantiteAlerte;
                        return (
                          <tr key={p.id} className={isAlert ? 'bg-red-50' : 'hover:bg-gray-50'}>
                            <td className="px-5 py-4">
                              <div className="font-medium text-gray-900">{p.nom}</div>
                              {p.description && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{p.description}</div>}
                            </td>
                            <td className="px-5 py-4 text-gray-500">{p.marque}</td>
                            <td className="px-5 py-4 text-gray-500 text-sm">{p.categorie}</td>
                            <td className="px-5 py-4 text-center">
                              <span className={`font-bold ${isAlert ? 'text-red-600' : 'text-gray-900'}`}>
                                {p.quantiteStock} <span className="text-xs font-normal text-gray-400">{p.unite}</span>
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center text-gray-400 text-sm">{p.quantiteAlerte}</td>
                            <td className="px-5 py-4">
                              {p.consommations && p.consommations.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {p.consommations.map((c, i) => (
                                    <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                                      {c.service.nom} <span className="text-purple-400">({Number(c.quantite)} {p.unite})</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleUpdateStock(p.id, 10, 'add')}
                                  className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100"
                                >
                                  +10
                                </button>
                                <button
                                  onClick={() => handleUpdateStock(p.id, -1, 'add')}
                                  className="text-xs bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100"
                                >
                                  −1
                                </button>
                                <button
                                  onClick={() => openEditProduit(p)}
                                  className="text-xs bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-100"
                                  title="Modifier"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {produits.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-10 text-gray-400">Aucun produit</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mouvements de stock */}
                <div className="mt-8">
                  <button
                    onClick={() => { setShowMouvements(!showMouvements); if (!showMouvements && mouvements.length === 0) loadMouvements(); }}
                    className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    <Package className="h-4 w-4" /> {showMouvements ? 'Masquer' : 'Voir'} les mouvements de stock (derniers 50)
                  </button>

                  {showMouvements && (
                    <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-x-auto">
                      {mouvementsLoading ? (
                        <p className="text-center py-8 text-gray-400">Chargement…</p>
                      ) : mouvements.length === 0 ? (
                        <p className="text-center py-8 text-gray-400">Aucun mouvement enregistré</p>
                      ) : (
                        <table className="w-full min-w-[600px]">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Date</th>
                              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Produit</th>
                              <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Quantité</th>
                              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Coiffeuse</th>
                              <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Cliente</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {mouvements.map((m) => (
                              <tr key={m.id} className="hover:bg-gray-50">
                                <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                                  {new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-5 py-3">
                                  <span className="font-medium text-gray-800">{m.produit.nom}</span>
                                  {m.produit.marque && <span className="text-xs text-gray-400 ml-1">{m.produit.marque}</span>}
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <span className="text-red-600 font-medium">−{Number(m.quantite).toFixed(3)} {m.produit.unite}</span>
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-600">
                                  {m.coiffeuse ? `${m.coiffeuse.prenom} ${m.coiffeuse.nom}` : '—'}
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-600">
                                  {m.rendezVous?.cliente ? `${m.rendezVous.cliente.prenom} ${m.rendezVous.cliente.nom}` : (m.rendezVous ? 'Client présentiel' : '—')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── DÉPENSES ──────────────────────────────────────────────────── */}
            {tab === 'depenses' && (
              <div>
                <div className="flex flex-wrap gap-3 mb-6 items-center">
                  <h2 className="text-lg font-bold text-gray-900 mr-auto">Dépenses</h2>
                  <select title="Mois" value={depenseMois} onChange={(e) => setDepenseMois(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none">
                    {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <input type="number" title="Année" value={depenseAnnee} onChange={(e) => setDepenseAnnee(Number(e.target.value))}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
                  <button onClick={() => setShowAddDepense(!showAddDepense)}
                    className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
                    <Plus className="h-4 w-4" /> Ajouter
                  </button>
                </div>

                {/* Summary cards */}
                {depensesData && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500">Total dépenses</p>
                      <p className="text-2xl font-bold text-red-600 mt-1">{depensesData.total.toFixed(2)} dt</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500">Nombre de dépenses</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{depensesData.depenses.length}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500">Mois</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][depenseMois - 1]} {depenseAnnee}
                      </p>
                    </div>
                  </div>
                )}

                {/* Resume par coiffeuse (salaire - avances) */}
                {depensesData && depensesData.resumeCoiffeuses && depensesData.resumeCoiffeuses.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Users className="h-4 w-4 text-purple-600" /> Résumé par personne — Reste à payer en fin de mois
                      </h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Coiffeuse</th>
                          <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Salaire</th>
                          <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Avances</th>
                          <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Total dépenses</th>
                          <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Reste à payer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {depensesData.resumeCoiffeuses.map((r, i) => (
                          <tr key={i}>
                            <td className="px-5 py-3 font-medium text-gray-900">{r.prenom} {r.nom}</td>
                            <td className="px-5 py-3 text-center text-gray-700">{r.salaire != null ? `${r.salaire.toFixed(0)} dt` : '—'}</td>
                            <td className="px-5 py-3 text-center text-orange-600 font-medium">{r.avances.toFixed(0)} dt</td>
                            <td className="px-5 py-3 text-center text-red-600 font-medium">{r.totalDepenses.toFixed(0)} dt</td>
                            <td className="px-5 py-3 text-center">
                              <span className={`font-bold ${r.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.net.toFixed(0)} dt</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add depense form */}
                {showAddDepense && (
                  <form onSubmit={handleAddDepense} className="bg-white rounded-xl p-6 border border-gray-200 mb-6 space-y-4">
                    <h3 className="font-bold text-gray-900">Nouvelle dépense</h3>
                    {depenseError && <p className="text-red-600 text-sm">{depenseError}</p>}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <input required placeholder="Libellé" value={newDepense.label}
                        onChange={(e) => setNewDepense((p) => ({ ...p, label: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <input required type="number" step="0.01" min="0" placeholder="Montant (dt)" value={newDepense.montant}
                        onChange={(e) => setNewDepense((p) => ({ ...p, montant: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <select title="Type" value={newDepense.type} onChange={(e) => setNewDepense((p) => ({ ...p, type: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none">
                        {TYPES_DEPENSE.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select title="Coiffeuse (optionnel)" value={newDepense.coiffeuseId}
                        onChange={(e) => setNewDepense((p) => ({ ...p, coiffeuseId: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none">
                        <option value="">— Aucune coiffeuse —</option>
                        {coiffeuses.map((c) => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
                      </select>
                      <input type="date" title="Date de la dépense" value={newDepense.dateDepense}
                        onChange={(e) => setNewDepense((p) => ({ ...p, dateDepense: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                      <input placeholder="Notes (optionnel)" value={newDepense.notes}
                        onChange={(e) => setNewDepense((p) => ({ ...p, notes: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-900 outline-none" />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium">Enregistrer</button>
                      <button type="button" onClick={() => setShowAddDepense(false)} className="text-gray-500 px-5 py-2 rounded-lg text-sm">Annuler</button>
                    </div>
                  </form>
                )}

                {/* Depenses histori */}
                {depensesData && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">Historique des dépenses</h3>
                    </div>
                    <table className="w-full min-w-[600px]">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Date</th>
                          <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Libellé</th>
                          <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Type</th>
                          <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Personne</th>
                          <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Statut</th>
                          <th className="text-center text-xs text-gray-500 font-medium px-5 py-3">Montant</th>
                          <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {depensesData.depenses.length === 0 && (
                          <tr><td colSpan={7} className="text-center py-10 text-gray-400">Aucune dépense ce mois</td></tr>
                        )}
                        {depensesData.depenses.map((d) => (
                          <tr key={d.id} className={`hover:bg-gray-50 ${!d.payee ? 'bg-amber-50/40' : ''}`}>
                            <td className="px-5 py-3 text-sm text-gray-700">
                              {d.dateDepense ? new Date(d.dateDepense).toLocaleDateString('fr-FR') : new Date(d.createdAt).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="px-5 py-3 text-sm font-medium text-gray-900">
                              {d.label}
                              {d.notes && <span className="block text-xs text-gray-400">{d.notes}</span>}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                d.type === 'SALAIRE' ? 'bg-blue-100 text-blue-700' :
                                d.type === 'AVANCE' ? 'bg-orange-100 text-orange-700' :
                                d.type === 'CHARGE' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{d.type}</span>
                            </td>
                            <td className="px-5 py-3 text-sm text-gray-600">
                              {d.coiffeuse ? `${d.coiffeuse.prenom} ${d.coiffeuse.nom}` : '—'}
                            </td>
                            <td className="px-5 py-3 text-center">
                              {d.payee ? (
                                <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">Payée</span>
                              ) : (
                                <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">En attente</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-center text-sm font-bold text-red-600">{Number(d.montant).toFixed(2)} dt</td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!d.payee && (
                                  <button onClick={() => handlePayerDepense(d.id)}
                                    className="text-green-500 hover:text-green-700" title="Marquer payée">
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                )}
                                <button onClick={() => handleDeleteDepense(d.id)} className="text-red-500 hover:text-red-700" title="Supprimer">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── PARAMÈTRES ──────────────────────────────────────────────── */}
            {tab === 'parametres' && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings className="h-7 w-7 text-purple-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Paramètres du salon</h2>
                  <p className="text-gray-500 text-sm mb-5 max-w-xs">
                    Gérez les informations du salon, les horaires d&apos;ouverture et vos préférences de compte.
                  </p>
                  <a
                    href="/parametres"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <Settings className="h-4 w-4" />
                    Ouvrir les paramètres
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    {/* ── MODAL MODIFIER PRODUIT ───────────────────────────────────────── */}
    {editingProduit && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingProduit(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" /> Modifier — {editingProduit.nom}
            </h3>
            <button onClick={() => setEditingProduit(null)} title="Fermer" className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSaveProduit} className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nom</label>
                <input required title="Nom du produit" value={editProduitForm.nom}
                  onChange={(e) => setEditProduitForm((p) => ({ ...p, nom: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Marque</label>
                <input required title="Marque" value={editProduitForm.marque}
                  onChange={(e) => setEditProduitForm((p) => ({ ...p, marque: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Catégorie</label>
                <input required title="Catégorie" value={editProduitForm.categorie}
                  onChange={(e) => setEditProduitForm((p) => ({ ...p, categorie: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Unité</label>
                <select title="Unité" value={editProduitForm.uniteCustom}
                  onChange={(e) => setEditProduitForm((p) => ({ ...p, uniteCustom: e.target.value, unite: e.target.value === 'autre' ? '' : e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none">
                  {UNITES_PREDEFINIES.map((u) => <option key={u} value={u}>{u}</option>)}
                  <option value="autre">Autre…</option>
                </select>
                {editProduitForm.uniteCustom === 'autre' && (
                  <input required title="Unité personnalisée" placeholder="ex: mèche" value={editProduitForm.unite}
                    onChange={(e) => setEditProduitForm((p) => ({ ...p, unite: e.target.value }))}
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Seuil alerte</label>
                <input type="number" min="0" title="Seuil alerte" value={editProduitForm.quantiteAlerte}
                  onChange={(e) => setEditProduitForm((p) => ({ ...p, quantiteAlerte: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Prix achat (dt)</label>
                <input type="number" step="0.01" min="0" title="Prix achat" value={editProduitForm.prixAchatUnite}
                  onChange={(e) => setEditProduitForm((p) => ({ ...p, prixAchatUnite: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description (optionnel)</label>
              <textarea rows={2} value={editProduitForm.description}
                onChange={(e) => setEditProduitForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Utilisation, notes…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none resize-none" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800">
                Enregistrer
              </button>
              <button type="button" onClick={() => setEditingProduit(null)} className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700">
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* ── MODAL MODIFIER COIFFEUSE ─────────────────────────────────────── */}
    {editingCoiffeuse && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingCoiffeuse(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <Scissors className="h-5 w-5 text-purple-600" /> Modifier — {editingCoiffeuse.prenom} {editingCoiffeuse.nom}
            </h3>
            <button onClick={() => setEditingCoiffeuse(null)} title="Fermer" className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSaveCoiffeuse} className="p-6 space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bio</label>
              <textarea rows={3} value={editCoiffeuseForm.bio}
                onChange={(e) => setEditCoiffeuseForm((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Présentation de la coiffeuse…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Spécialités (séparées par virgule)</label>
              <input value={editCoiffeuseForm.specialites}
                onChange={(e) => setEditCoiffeuseForm((p) => ({ ...p, specialites: e.target.value }))}
                placeholder="Colorisation, Tresses, Défrisage…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Niveau</label>
                <select title="Niveau" value={editCoiffeuseForm.niveau}
                  onChange={(e) => setEditCoiffeuseForm((p) => ({ ...p, niveau: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none">
                  <option value="JUNIOR">Junior</option>
                  <option value="CONFIRMEE">Confirmée</option>
                  <option value="SENIOR">Senior</option>
                  <option value="EXPERT">Experte</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Salaire mensuel (dt)</label>
                <input type="number" step="0.01" min="0" placeholder="ex: 1200"
                  value={editCoiffeuseForm.salaire}
                  onChange={(e) => setEditCoiffeuseForm((p) => ({ ...p, salaire: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800">
                Enregistrer
              </button>
              <button type="button" onClick={() => setEditingCoiffeuse(null)} className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700">
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* ── MODAL INGRÉDIENTS ─────────────────────────────────────────────── */}
    {ingModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={() => setIngModal(null)}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-600" />
                Ingrédients — {ingModal.nom}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">Produits consommés lors de ce service</p>
            </div>
            <button onClick={() => setIngModal(null)} title="Fermer" className="text-gray-400 hover:text-gray-600 ml-4 mt-0.5">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 p-6 space-y-2.5">
            {loadingIng ? (
              <p className="text-center text-gray-400 py-8">Chargement…</p>
            ) : ingredients.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Aucun ingrédient lié à ce service</p>
            ) : (
              ingredients.map((ing) => {
                const isAlert = ing.produit.quantiteStock <= ing.produit.quantiteAlerte;
                return (
                  <div
                    key={ing.produitId}
                    className={`flex items-center justify-between p-3.5 rounded-xl border ${
                      isAlert ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{ing.produit.nom}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-semibold text-gray-700">
                          {Number(ing.quantite)} {ing.produit.unite}
                        </span>
                        {' '}par service ·{' '}
                        <span className={isAlert ? 'text-red-600 font-medium' : 'text-gray-500'}>
                          Stock&nbsp;: {ing.produit.quantiteStock} {ing.produit.unite}
                          {isAlert && ' ⚠️'}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteIngredient(ing.produitId)}
                      className="text-red-400 hover:text-red-600 ml-3 flex-shrink-0"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Add ingredient form */}
          <div className="border-t border-gray-100 p-6 bg-gray-50 rounded-b-2xl">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Ajouter / modifier un ingrédient</h4>
            {ingError && <p className="text-red-600 text-xs mb-2">{ingError}</p>}
            <form onSubmit={handleAddIngredient} className="flex gap-2">
              <select
                required
                title="Choisir un produit"
                value={ingForm.produitId}
                onChange={(e) => setIngForm((p) => ({ ...p, produitId: e.target.value }))}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white min-w-0"
              >
                <option value="">Choisir un produit…</option>
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} ({p.unite}) — stock : {p.quantiteStock}
                  </option>
                ))}
              </select>
              <input
                required
                type="number"
                step="0.001"
                min="0.001"
                placeholder="Qté"
                value={ingForm.quantite}
                onChange={(e) => setIngForm((p) => ({ ...p, quantite: e.target.value }))}
                className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <button
                type="submit"
                title="Ajouter l'ingrédient"
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    )}
  </div>
  );
}
