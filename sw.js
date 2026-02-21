// PageTurn SW v4
const CACHE_NAME = 'pageturn-v4';

// Use relative URLs — works regardless of GitHub Pages subdirectory
const ASSETS = [
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512-maskable.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache each file individually so one failure doesn't break all
      return Promise.allSettled(
        ASSETS.map(asset =>
          cache.add(new Request(asset, { cache: 'reload' }))
            .catch(e => console.warn('[SW] Failed to cache:', asset, e))
        )
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        // Network first for HTML, cache first for everything else
        const isHTML = event.request.destination === 'document';
        if (isHTML) {
          return fetch(event.request)
            .then(res => { cache.put(event.request, res.clone()); return res; })
            .catch(() => cached || caches.match('index.html'));
        }
        return cached || fetch(event.request).then(res => {
          if (res.status === 200) cache.put(event.request, res.clone());
          return res;
        });
      })
    )
  );
});
