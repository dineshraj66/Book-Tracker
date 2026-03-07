const CACHE = 'pageturn-v12';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
// No caching of HTML — always fetch fresh so updates deploy instantly
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Only cache assets (js, css, images), never the HTML page itself
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/Page_Turn/')) return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && res.status === 200) cache.put(e.request, res.clone());
        return res;
      }))
    )
  );
});
