'use client';

import { Phone, Mail, MapPin, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import LogoBloom from './LogoBloom';

interface SalonInfo {
  nomSalon: string;
  slogan: string | null;
  adresse: string | null;
  ville: string | null;
  telephone: string | null;
  emailContact: string | null;
  googleMapsUrl: string | null;
  horaireOuverture: string | null;
}

const FALLBACK: SalonInfo = {
  nomSalon: 'Salon Beauté',
  slogan: 'Votre salon de coiffure féminin. Expertise, passion et résultats sublimes.',
  adresse: '12 Rue de la Beauté',
  ville: 'Paris',
  telephone: '01 23 45 67 89',
  emailContact: 'contact@salon-beaute.fr',
  googleMapsUrl: null,
  horaireOuverture: 'Lun-Ven : 9h-19h\nSam : 9h-17h\nDim : Fermé',
};

export default function Footer() {
  const [info, setInfo] = useState<SalonInfo>(FALLBACK);

  useEffect(() => {
    fetch('/api/public/parametres')
      .then((r) => r.json())
      .then((res) => {
        const d = res?.data || res;
        if (d && d.nomSalon) setInfo({ ...FALLBACK, ...d });
      })
      .catch(() => { /* use fallback */ });
  }, []);

  const rawHoraire = info.horaireOuverture ?? FALLBACK.horaireOuverture ?? '';
  const horaires = (typeof rawHoraire === 'string' ? rawHoraire : FALLBACK.horaireOuverture ?? '').split('\n').filter(Boolean);

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <LogoBloom size="sm" color="#ffffff" />
            </div>
            <p className="text-gray-400 text-sm">
              {info.slogan ?? FALLBACK.slogan}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold mb-4 text-pink-400">Navigation</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/services" className="hover:text-white transition-colors">Nos Services</Link></li>
              <li><Link href="/coiffeuses" className="hover:text-white transition-colors">Nos Coiffeuses</Link></li>
              <li><Link href="/reservation" className="hover:text-white transition-colors">Réserver en ligne</Link></li>
            </ul>
          </div>

          {/* Horaires */}
          <div>
            <h3 className="font-semibold mb-4 text-pink-400">Horaires</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              {horaires.length > 0
                ? horaires.map((h, i) => <li key={i}>{h}</li>)
                : <><li>Lun - Ven : 9h - 19h</li><li>Sam : 9h - 17h</li><li>Dim : Fermé</li></>}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-pink-400">Contact</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              {info.telephone && (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={`tel:${info.telephone}`} className="hover:text-white transition-colors">{info.telephone}</a>
                </li>
              )}
              {info.emailContact && (
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${info.emailContact}`} className="hover:text-white transition-colors">{info.emailContact}</a>
                </li>
              )}
              {(info.adresse || info.ville) && (
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{[info.adresse, info.ville].filter(Boolean).join(', ')}</span>
                </li>
              )}
              {info.googleMapsUrl && (
                <li className="mt-2">
                  <a href={info.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-pink-400 hover:text-pink-300 text-xs transition-colors">
                    <ExternalLink className="h-3 w-3" /> Voir sur Google Maps
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} {info.nomSalon}. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
