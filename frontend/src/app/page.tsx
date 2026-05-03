'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Scissors, Star, Calendar, Heart, Sparkles, Clock, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../lib/api';

const services = [
  { icon: Scissors, title: 'Coupe & Styling', desc: 'Coupes tendances personnalisées pour sublimer votre visage', color: 'from-pink-500 to-rose-500' },
  { icon: Sparkles, title: 'Coloration', desc: 'Balayage, mèches, ombré... La couleur qui vous ressemble', color: 'from-purple-500 to-violet-500' },
  { icon: Heart, title: 'Soins Capillaires', desc: 'Kératine, botox capillaire, soins profonds réparateurs', color: 'from-pink-400 to-fuchsia-500' },
  { icon: Star, title: 'Événements', desc: 'Mariage, gala, soirée... Une coiffure à la hauteur', color: 'from-amber-400 to-pink-500' },
];

export default function HomePage() {
  const [statsData, setStatsData] = useState({ note: '4.9', coiffeuses: '4', clients: '1200+', ans: '8+' });

  useEffect(() => {
    api.get('/coiffeuses').then((res) => {
      const coiffeuses = res.data.data || [];
      const avecAvis = coiffeuses.filter((c: { noteMoyenne?: number }) => c.noteMoyenne);
      const noteMoyenne = avecAvis.length > 0
        ? (avecAvis.reduce((s: number, c: { noteMoyenne: number }) => s + c.noteMoyenne, 0) / avecAvis.length).toFixed(1)
        : '4.9';
      setStatsData((prev) => ({
        ...prev,
        coiffeuses: String(coiffeuses.length) || '4',
        note: noteMoyenne,
      }));
    }).catch(() => {}); // keep defaults on error
  }, []);

  const stats = [
    { value: statsData.clients, label: 'Clientes satisfaites' },
    { value: statsData.note, label: 'Note moyenne' },
    { value: statsData.ans, label: "Années d'expérience" },
    { value: statsData.coiffeuses, label: 'Coiffeuses expertes' },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-pink-50 via-white to-purple-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 bg-pink-100 text-pink-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" /> Salon de coiffure féminin
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Révélez votre{' '}
                <span className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                  beauté naturelle
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Des coiffeuses passionnées à votre service. Expertise, écoute et résultats sublimes pour chaque type de cheveux.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/reservation"
                  className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-3.5 rounded-full text-lg font-semibold hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                >
                  <Calendar className="h-5 w-5" /> Réserver maintenant
                </Link>
                <Link
                  href="/services"
                  className="border-2 border-pink-300 text-pink-600 px-8 py-3.5 rounded-full text-lg font-semibold hover:bg-pink-50 transition-all"
                >
                  Voir nos services
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
        <div className="absolute top-10 left-10 w-20 h-20 bg-pink-200 rounded-full opacity-20 blur-xl" />
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-200 rounded-full opacity-20 blur-xl" />
      </section>

      {/* Stats */}
      <section className="bg-white py-12 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Nos Savoir-Faire</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Des prestations adaptées à chaque type de cheveux et à chaque envie
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all group"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-r ${service.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <service.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{service.title}</h3>
                <p className="text-gray-500 text-sm">{service.desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/services" className="text-pink-600 font-semibold hover:underline">
              Voir tous nos services →
            </Link>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Pourquoi nous choisir ?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Users, color: 'bg-pink-100 text-pink-600', title: 'Coiffeuses Expertes', desc: 'Chaque coiffeuse a ses spécialités. Choisissez celle qui correspond à vos besoins.' },
              { icon: Clock, color: 'bg-purple-100 text-purple-600', title: 'Réservation Facile', desc: 'Réservez en ligne 24/7. Choisissez votre coiffeuse, votre service et votre créneau.' },
              { icon: Heart, color: 'bg-fuchsia-100 text-fuchsia-600', title: 'Votre Carnet Beauté', desc: 'Historique de vos coupes, carnet capillaire personnalisé, photos avant/après.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex gap-4"
              >
                <div className={`shrink-0 w-12 h-12 ${item.color} rounded-xl flex items-center justify-center`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-pink-500 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Prête à être sublimée ?
          </h2>
          <p className="text-pink-100 text-lg mb-8">
            Prenez rendez-vous en quelques clics et laissez nos expertes prendre soin de vous.
          </p>
          <Link
            href="/reservation"
            className="inline-flex items-center gap-2 bg-white text-pink-600 px-8 py-4 rounded-full text-lg font-bold hover:shadow-2xl hover:scale-105 transition-all"
          >
            <Calendar className="h-5 w-5" /> Réserver mon créneau
          </Link>
        </div>
      </section>
    </div>
  );
}
