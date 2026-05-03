'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import api from '../../lib/api';
import { format, addDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ServiceAPI {
  id: string;
  nom: string;
  description: string;
  prixBase: string;
  dureeMinutes: number;
  categorie: string;
}

interface Service {
  id: string;
  nom: string;
  description: string;
  prix: number;
  duree: number;
  categorie: string;
}

interface Coiffeuse {
  id: string;
  nom: string;
  prenom: string;
  photoUrl?: string;
  specialites: string[];
  niveau: string;
}

interface Creneau {
  debut: string;
  fin: string;
}

const STEPS = ['Services', 'Coiffeuse', 'Date & Heure', 'Confirmation'];

export default function ReservationPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [coiffeuses, setCoiffeuses] = useState<Coiffeuse[]>([]);
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);

  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedCoiffeuse, setSelectedCoiffeuse] = useState<Coiffeuse | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1));
  const [selectedCreneau, setSelectedCreneau] = useState<Creneau | null>(null);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (!token) {
      router.push('/connexion?redirect=/reservation');
    }
  }, [token, router]);

  // Load services
  useEffect(() => {
    api.get('/services').then((r) => {
      const mapped = (r.data.data || []).map((s: ServiceAPI) => ({
        id: s.id,
        nom: s.nom,
        description: s.description,
        prix: parseFloat(s.prixBase) || 0,
        duree: s.dureeMinutes,
        categorie: s.categorie,
      }));
      setServices(mapped);
    }).catch(() => {});
  }, []);

  // Load coiffeuses
  useEffect(() => {
    if (step === 1) {
      api.get('/coiffeuses').then((r) => setCoiffeuses(r.data.data)).catch(() => {});
    }
  }, [step]);

  // Load créneaux
  useEffect(() => {
    if (step === 2 && selectedCoiffeuse && selectedDate) {
      setLoading(true);
      setSelectedCreneau(null);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const dureeTotal = selectedServices.reduce((a, s) => a + s.duree, 0);
      api
        .get(`/coiffeuses/${selectedCoiffeuse.id}/disponibilites?date=${dateStr}&duree=${dureeTotal}`)
        .then((r) => setCreneaux(r.data.data?.creneaux || []))
        .catch(() => setCreneaux([]))
        .finally(() => setLoading(false));
    }
  }, [step, selectedCoiffeuse, selectedDate, selectedServices]);

  const totalPrix = selectedServices.reduce((a, s) => a + s.prix, 0);
  const totalDuree = selectedServices.reduce((a, s) => a + s.duree, 0);

  const toggleService = (s: Service) => {
    setSelectedServices((prev) =>
      prev.find((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s]
    );
  };

  const canNext = () => {
    if (step === 0) return selectedServices.length > 0;
    if (step === 1) return selectedCoiffeuse !== null;
    if (step === 2) return selectedCreneau !== null;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/rendez-vous', {
        coiffeuseId: selectedCoiffeuse!.id,
        serviceIds: selectedServices.map((s) => s.id),
        dateHeure: selectedCreneau!.debut,
        note: notes,
      });
      router.push('/mon-espace?success=reservation');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erreur lors de la réservation');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate dates for next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i + 1));

  const groupedServices = services.reduce(
    (acc, s) => {
      if (!acc[s.categorie]) acc[s.categorie] = [];
      acc[s.categorie].push(s);
      return acc;
    },
    {} as Record<string, Service[]>
  );

  const categoryLabels: Record<string, string> = {
    COUPE: '✂️ Coupe',
    COLORATION: '🎨 Coloration',
    COIFFURE: '💇‍♀️ Coiffure',
    SOIN: '✨ Soin',
    LISSAGE: '🔥 Lissage',
    TRESSE: '🎀 Tresse',
    EXTENSION: '💫 Extension',
    AUTRE: '📌 Autre',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold">Réserver un rendez-vous</h1>
          <p className="text-pink-100 mt-1">Choisissez vos prestations et votre créneau idéal</p>

          {/* Stepper */}
          <div className="flex items-center mt-6 gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    i < step
                      ? 'bg-white text-purple-600'
                      : i === step
                        ? 'bg-white text-pink-600 ring-4 ring-white/30'
                        : 'bg-white/20 text-white/60'
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`ml-2 text-sm hidden sm:inline ${i === step ? 'text-white font-semibold' : 'text-white/60'}`}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-2 text-white/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>
        )}

        {/* Step 0: Services */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Choisissez vos prestations</h2>
            {Object.entries(groupedServices).map(([cat, items]) => (
              <div key={cat} className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  {categoryLabels[cat] || cat}
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {items.map((s) => {
                    const selected = selectedServices.find((x) => x.id === s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleService(s)}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          selected
                            ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200'
                            : 'border-gray-200 bg-white hover:border-pink-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">{s.nom}</p>
                            <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>
                          </div>
                          {selected && (
                            <Check className="h-5 w-5 text-pink-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex gap-3 mt-2">
                          <span className="text-sm text-pink-600 font-medium">{s.prix} dt</span>
                          <span className="text-sm text-gray-400">{s.duree} min</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Coiffeuse */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Choisissez votre coiffeuse</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {coiffeuses.map((c) => {
                const selected = selectedCoiffeuse?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCoiffeuse(c)}
                    className={`text-left p-5 rounded-xl border-2 transition-all ${
                      selected
                        ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200'
                        : 'border-gray-200 bg-white hover:border-pink-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                        {c.prenom[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {c.prenom} {c.nom}
                        </p>
                        <p className="text-sm text-purple-600 capitalize">{c.niveau}</p>
                      </div>
                      {selected && <Check className="h-5 w-5 text-pink-500 ml-auto" />}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {c.specialites.map((sp) => (
                        <span
                          key={sp}
                          className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full"
                        >
                          {sp}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Date & Heure */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Choisissez la date et l&apos;heure</h2>

            {/* Date picker */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Date
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => {
                  const active = isSameDay(d, selectedDate);
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelectedDate(d)}
                      className={`flex flex-col items-center min-w-[4.5rem] py-3 px-3 rounded-xl border-2 transition-all ${
                        active
                          ? 'border-pink-500 bg-pink-50 text-pink-600'
                          : 'border-gray-200 bg-white hover:border-pink-300 text-gray-700'
                      }`}
                    >
                      <span className="text-xs uppercase">
                        {format(d, 'EEE', { locale: fr })}
                      </span>
                      <span className="text-lg font-bold">{format(d, 'd')}</span>
                      <span className="text-xs">{format(d, 'MMM', { locale: fr })}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Créneaux */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Créneaux disponibles
              </h3>
              {loading ? (
                <div className="text-center py-8 text-gray-400">Chargement des créneaux...</div>
              ) : creneaux.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Aucun créneau disponible ce jour. Essayez une autre date.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {creneaux.map((c) => {
                    const active = selectedCreneau?.debut === c.debut;
                    return (
                      <button
                        key={c.debut}
                        onClick={() => setSelectedCreneau(c)}
                        className={`py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                          active
                            ? 'border-pink-500 bg-pink-500 text-white'
                            : 'border-gray-200 bg-white hover:border-pink-300 text-gray-700'
                        }`}
                      >
                        {format(new Date(c.debut), 'HH:mm')}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optionnel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none resize-none"
                placeholder="Précisions sur vos cheveux, vos envies..."
              />
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Confirmez votre rendez-vous</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <div>
                <span className="text-sm text-gray-500">Prestations</span>
                <ul className="mt-1 space-y-1">
                  {selectedServices.map((s) => (
                    <li key={s.id} className="flex justify-between">
                      <span className="text-gray-900">{s.nom}</span>
                      <span className="text-gray-600">{s.prix} dt</span>
                    </li>
                  ))}
                </ul>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Coiffeuse</span>
                <span className="font-medium text-gray-900">
                  {selectedCoiffeuse?.prenom} {selectedCoiffeuse?.nom}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Date</span>
                <span className="font-medium text-gray-900">
                  {selectedCreneau &&
                    format(new Date(selectedCreneau.debut), 'EEEE d MMMM yyyy', { locale: fr })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Heure</span>
                <span className="font-medium text-gray-900">
                  {selectedCreneau && format(new Date(selectedCreneau.debut), 'HH:mm')} -{' '}
                  {selectedCreneau && format(new Date(selectedCreneau.fin), 'HH:mm')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Durée totale</span>
                <span className="font-medium text-gray-900">{totalDuree} min</span>
              </div>
              {notes && (
                <div>
                  <span className="text-sm text-gray-500">Notes</span>
                  <p className="text-gray-700 mt-0.5">{notes}</p>
                </div>
              )}
              <hr />
              <div className="flex justify-between text-lg">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-pink-600">{totalPrix} dt</span>
              </div>
            </div>
          </div>
        )}

        {/* Summary sidebar */}
        {step < 3 && selectedServices.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mt-6">
            <h4 className="font-semibold text-gray-900 text-sm">Récapitulatif</h4>
            <div className="mt-2 space-y-1">
              {selectedServices.map((s) => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{s.nom}</span>
                  <span className="text-gray-900">{s.prix} dt</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-pink-600 mt-2 pt-2 border-t">
              <span>Total</span>
              <span>{totalPrix} dt · {totalDuree} min</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              step === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft className="h-4 w-4" /> Retour
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                canNext()
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-3 rounded-lg font-semibold bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:shadow-lg disabled:opacity-50 transition-all"
            >
              {submitting ? 'Réservation...' : 'Confirmer la réservation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
