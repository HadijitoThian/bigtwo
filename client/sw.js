const CACHE_NAME = 'bigtwo-v3';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/sounds.js',
  '/manifest.json',
  '/audio/lobby.mp3',
  '/img/bg-table.jpg',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/socket.io/socket.io.js',
];

// Install: precache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        // Non-critical — app still works without full precache
        console.warn('Precache failed (some assets may be missing):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches, take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      // Take control of all clients immediately
      await self.clients.claim();
    })()
  );
});

// Fetch: cache-first for static assets, network-only for socket.io
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't cache socket.io WebSocket connections
  if (url.pathname.startsWith('/socket.io/') && event.request.method !== 'GET') {
    return; // Let it go through as-is (WebSocket upgrade)
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached response immediately, update cache in background
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => cached); // Fall back to cache if network fails

      return cached || fetchPromise;
    })
  );
});
