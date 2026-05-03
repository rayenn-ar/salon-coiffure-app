'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (sw.js) on first mount.
 * Runs only in the browser, silently skips in non-secure contexts (dev over HTTP).
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[SW] Registered with scope:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] New version available. Refresh to update.');
            }
          });
        });
      } catch (err) {
        // Non-fatal — app works without SW
        console.warn('[SW] Registration failed:', err);
      }
    };

    // Defer until after the page is interactive to avoid blocking the first paint
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
