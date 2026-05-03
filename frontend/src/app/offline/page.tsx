'use client';

import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="max-w-md">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#C4A882]/20 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-[#C4A882]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 3l18 18M10.584 10.587a2 2 0 002.828 2.83M9.172 9.172A4 4 0 0114.83 14.83m1.415 1.415A6 6 0 016.343 6.343m10.586 10.586A8 8 0 015.373 5.373"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Vous êtes hors ligne
        </h1>

        <p className="text-gray-500 mb-8 leading-relaxed">
          Impossible de charger cette page. Vérifiez votre connexion Internet et réessayez.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-[#C4A882] text-white font-medium hover:bg-[#b09070] transition-colors"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
