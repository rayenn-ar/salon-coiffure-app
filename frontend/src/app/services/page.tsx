'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, DollarSign, Sparkles } from 'lucide-react';
import Link from 'next/link';
import api from '../../lib/api';

interface ServiceOption {
  id: string;
  nom: string;
  prixSupplement: number;
}

interface Service {
  id: string;
  nom: string;
  description?: string;
  prixBase: number;
  dureeMinutes: number;
  categorie: string;
  options?: ServiceOption[];
}

const categorieLabels: Record<string, string> = {
  COUPE: '✂️ Coupe & Styling',
  COLORATION: '🎨 Coloration & Techniques',
  SOIN: '💆 Soins & Traitements',
  COIFFAGE_EVENEMENT: '👑 Coiffure Événement',
  EXTENSION: '✨ Extensions',
  FORFAIT: '📦 Forfaits',
};

const categorieColors: Record<string, string> = {
  COUPE: 'border-pink-300 bg-pink-50',
  COLORATION: 'border-purple-300 bg-purple-50',
  SOIN: 'border-green-300 bg-green-50',
  COIFFAGE_EVENEMENT: 'border-amber-300 bg-amber-50',
  EXTENSION: 'border-blue-300 bg-blue-50',
  FORFAIT: 'border-fuchsia-300 bg-fuchsia-50',
};

export default function ServicesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await api.get('/services');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const servicesByCategorie = data?.reduce((acc: Record<string, Service[]>, s: Service) => {
    const cat = s.categorie;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, Service[]>) || {};

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <section className="bg-gradient-to-r from-pink-500 to-purple-600 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Nos Services</h1>
          <p className="text-pink-100 text-lg max-w-2xl mx-auto">
            Découvrez notre gamme complète de prestations pour sublimer votre chevelure
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin h-12 w-12 border-4 border-pink-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-4">Chargement des services...</p>
          </div>
        ) : (
          Object.entries(categorieLabels).map(([cat, label]) => {
            const servicesInCat = servicesByCategorie[cat];
            if (!servicesInCat || servicesInCat.length === 0) return null;

            return (
              <div key={cat} className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{label}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {servicesInCat.map((service: Service, i: number) => (
                    <motion.div
                      key={service.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      viewport={{ once: true }}
                      className={`border rounded-xl p-5 hover:shadow-md transition-all ${categorieColors[cat] || 'bg-white'}`}
                    >
                      <h3 className="font-bold text-gray-900 text-lg mb-2">{service.nom}</h3>
                      {service.description && (
                        <p className="text-gray-600 text-sm mb-3">{service.description}</p>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-gray-700 font-semibold">
                          <DollarSign className="h-4 w-4 text-pink-500" />
                          {Number(service.prixBase).toFixed(0)} dt
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock className="h-4 w-4" />
                          {service.dureeMinutes} min
                        </span>
                      </div>
                      {(service.options?.length ?? 0) > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Options :</p>
                          {service.options!.map((opt: ServiceOption) => (
                            <span key={opt.id} className="inline-block text-xs bg-white/60 rounded-full px-2 py-0.5 mr-1 mb-1 text-gray-600">
                              {opt.nom} (+{Number(opt.prixSupplement).toFixed(0)} dt)
                            </span>
                          ))}
                        </div>
                      )}
                      <Link
                        href={`/reservation?service=${service.id}`}
                        className="mt-4 block w-full text-center bg-white border border-pink-300 text-pink-600 py-2 rounded-lg text-sm font-medium hover:bg-pink-50 transition-colors"
                      >
                        Réserver ce service
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* CTA */}
        <div className="text-center mt-8">
          <Link
            href="/reservation"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transition-all"
          >
            <Sparkles className="h-5 w-5" /> Réserver un service
          </Link>
        </div>
      </div>
    </div>
  );
}
