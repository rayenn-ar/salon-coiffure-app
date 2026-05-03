/**
 * Service Worker — Salon de Coiffure PWA
 *
 * Strategies:
 *  - Static assets (JS/CSS/fonts)  → Cache-first
 *  - API calls (/api/*)            → Network-only (never cache auth/data)
 *  - HTML pages                    → Network-first with offline fallback
 *  - Push notifications            → display notification + badge
 */

const CACHE_NAME = 'salon-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
];

// ==================== Install ====================

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// ==================== Activate ====================

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ==================== Fetch ====================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls, WebSockets, or non-GET requests
  if (
    url.pathname.startsWith('/api/') ||
    request.method !== 'GET' ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // Static assets — cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|otf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML navigation — network-first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
      )
    );
    return;
  }
});

// ==================== Push Notifications ====================

self.addEventListener('push', (event) => {
  let data = { title: 'Salon de Coiffure', body: 'Vous avez une nouvelle notification.', icon: '/icons/icon-192x192.png', badge: '/icons/icon-72x72.png', data: {} };

  if (event.data) {
    try {
      data = { ...data, ...JSON.parse(event.data.text()) };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      vibrate: [200, 100, 200],
      data: data.data,
      actions: [
        { action: 'open', title: 'Ouvrir' },
        { action: 'close', title: 'Fermer' },
      ],
    })
  );
});

// ==================== Notification Click ====================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/mon-espace';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(urlToOpen) && 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(urlToOpen);
    })
  );
});
