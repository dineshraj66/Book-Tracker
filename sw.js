// sw.js - self-destructs to force fresh load
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  // Wipe every cache
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  // Unregister this SW so the inline blob SW takes over
  await self.registration.unregister();
  // Force all clients to reload
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(c => c.navigate(c.url));
});
