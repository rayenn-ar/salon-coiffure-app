'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Star, Scissors } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import api from '../../lib/api';

interface PortfolioPhoto {
  id: string;
  url?: string;
}

interface CoiffeuseListing {
  id: string;
  nom: string;
  prenom: string;
  bio?: string;
  photoUrl?: string;
  specialites: string[];
  niveau: string;
  noteMoyenne?: number;
  nombreAvis?: number;
  portfolioPhotos?: PortfolioPhoto[];
}

const niveauLabels: Record<string, string> = {
  JUNIOR: 'Junior',
  CONFIRMEE: 'Confirmée',
  EXPERTE: 'Experte',
};

const niveauColors: Record<string, string> = {
  JUNIOR: 'bg-blue-100 text-blue-700',
  CONFIRMEE: 'bg-purple-100 text-purple-700',
  EXPERTE: 'bg-pink-100 text-pink-700',
};

export default function CoiffeusesPage() {
  const { data: coiffeuses, isLoading } = useQuery({
    queryKey: ['coiffeuses'],
    queryFn: async () => {
      const res = await api.get('/coiffeuses');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <section className="bg-gradient-to-r from-purple-500 to-pink-600 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Nos Coiffeuses</h1>
          <p className="text-purple-100 text-lg max-w-2xl mx-auto">
            Des professionnelles passionnées, chacune avec ses spécialités
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin h-12 w-12 border-4 border-pink-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-4">Chargement...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coiffeuses?.map((coiffeuse: CoiffeuseListing, i: number) => (
              <motion.div
                key={coiffeuse.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all"
              >
                {/* Avatar or photo */}
                <div className="h-48 bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center relative overflow-hidden">
                  {coiffeuse.photoUrl ? (
                    <Image
                      src={coiffeuse.photoUrl}
                      alt={`${coiffeuse.prenom} ${coiffeuse.nom}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-white/30 rounded-full flex items-center justify-center">
                      <Scissors className="h-10 w-10 text-white" />
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-900 text-xl">
                      {coiffeuse.prenom} {coiffeuse.nom}
                    </h3>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${niveauColors[coiffeuse.niveau] || 'bg-gray-100 text-gray-700'}`}>
                      {niveauLabels[coiffeuse.niveau] || coiffeuse.niveau}
                    </span>
                  </div>

                  {coiffeuse.bio && (
                    <p className="text-gray-500 text-sm mb-4">{coiffeuse.bio}</p>
                  )}

                  {/* Note */}
                  {coiffeuse.noteMoyenne && (
                    <div className="flex items-center gap-1 mb-3">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      <span className="font-semibold text-sm">{Number(coiffeuse.noteMoyenne).toFixed(1)}</span>
                      <span className="text-gray-400 text-sm">({coiffeuse.nombreAvis} avis)</span>
                    </div>
                  )}

                  {/* Spécialités */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {coiffeuse.specialites?.map((spec: string) => (
                      <span
                        key={spec}
                        className="text-xs bg-pink-50 text-pink-600 px-2.5 py-1 rounded-full"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>

                  {/* Portfolio preview */}
                  {(coiffeuse.portfolioPhotos?.length ?? 0) > 0 && (
                    <div className="grid grid-cols-4 gap-1 mb-4 rounded-lg overflow-hidden">
                      {coiffeuse.portfolioPhotos!.slice(0, 4).map((photo: PortfolioPhoto) => (
                        <div key={photo.id} className="aspect-square bg-gray-100 relative overflow-hidden">
                          {photo.url && (
                            <Image
                              src={photo.url}
                              alt="Réalisation"
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/reservation?coiffeuse=${coiffeuse.id}`}
                    className="block w-full text-center bg-gradient-to-r from-pink-500 to-purple-600 text-white py-2.5 rounded-full font-medium hover:shadow-md transition-all"
                  >
                    Réserver avec {coiffeuse.prenom}
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
