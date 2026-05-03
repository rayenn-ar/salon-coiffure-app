'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { Menu, X, User, LogOut } from 'lucide-react';
import LogoBloom from './LogoBloom';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [salonName, setSalonName] = useState('Salon Beauté');
  const { isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    fetch('/api/public/parametres')
      .then((r) => r.json())
      .then((res) => {
        const d = res?.data || res;
        if (d?.nomSalon) setSalonName(d.nomSalon);
      })
      .catch(() => { /* use fallback */ });
  }, []);

  const isAuth = mounted && isAuthenticated;

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <LogoBloom size="sm" color="#000000" />
          </Link>

          {/* Menu desktop */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/services" className="text-gray-700 hover:text-pink-600 transition-colors font-medium">
              Services
            </Link>
            <Link href="/coiffeuses" className="text-gray-700 hover:text-pink-600 transition-colors font-medium">
              Nos Coiffeuses
            </Link>
            <Link href="/reservation" className="text-gray-700 hover:text-pink-600 transition-colors font-medium">
              Réserver
            </Link>

            {isAuth ? (
              <div className="flex items-center gap-4">
                <Link
                  href={user?.role === 'ADMIN' ? '/admin' : user?.role === 'COIFFEUSE' ? '/espace-pro' : '/mon-espace'}
                  className="flex items-center gap-1 text-gray-700 hover:text-pink-600 transition-colors"
                >
                  <User className="h-4 w-4" />
                  {user?.prenom}
                </Link>
                <button
                  aria-label="Se déconnecter"
                  onClick={logout}
                  className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/connexion" className="text-gray-700 hover:text-pink-600 transition-colors font-medium">
                  Connexion
                </Link>
                <Link
                  href="/inscription"
                  className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-5 py-2 rounded-full hover:shadow-lg transition-all font-medium"
                >
                  S&apos;inscrire
                </Link>
              </div>
            )}
          </div>

          {/* Menu mobile toggle */}
          <button className="md:hidden flex items-center" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {isOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-3 space-y-3">
            <Link href="/services" className="block text-gray-700 hover:text-pink-600 font-medium" onClick={() => setIsOpen(false)}>
              Services
            </Link>
            <Link href="/coiffeuses" className="block text-gray-700 hover:text-pink-600 font-medium" onClick={() => setIsOpen(false)}>
              Nos Coiffeuses
            </Link>
            <Link href="/reservation" className="block text-gray-700 hover:text-pink-600 font-medium" onClick={() => setIsOpen(false)}>
              Réserver
            </Link>
            {isAuth ? (
              <>
                <Link
                  href={user?.role === 'ADMIN' ? '/admin' : user?.role === 'COIFFEUSE' ? '/espace-pro' : '/mon-espace'}
                  className="block text-gray-700 hover:text-pink-600 font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  {user?.role === 'ADMIN' ? 'Administration' : user?.role === 'COIFFEUSE' ? 'Espace Pro' : 'Mon Espace'}
                </Link>
                <button onClick={() => { logout(); setIsOpen(false); }} className="block text-red-500 font-medium">
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link href="/connexion" className="block text-gray-700 hover:text-pink-600 font-medium" onClick={() => setIsOpen(false)}>
                  Connexion
                </Link>
                <Link href="/inscription" className="block text-pink-600 font-bold" onClick={() => setIsOpen(false)}>
                  S&apos;inscrire
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
