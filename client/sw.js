const CACHE_NAME = 'bigtwo-v5';
const PRECACHE_URLS = [
  '/manifest.json',
  '/img/bg-table.jpg',
  '/img/icon-192.png',
  '/img/icon-512.png',
];

// Install: precache static assets (skip HTML/JS so they always come from network)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('Precache failed (some assets may be missing):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches, take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept socket.io — must go straight to network for WebSocket upgrade
  if (url.pathname.startsWith('/socket.io/')) return;

  // Only handle GET
  if (event.request.method !== 'GET') return;

  const isStaticAsset = /\.(png|jpg|jpeg|gif|webp|svg|mp3|wav|ogg|woff2?|ttf)$/i.test(url.pathname);

  if (isStaticAsset) {
    // Cache-first for binary assets (images, audio, fonts)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML/JS/CSS/JSON — always try fresh, fall back to cache offline
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
