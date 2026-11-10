// The Cookbook moved to https://on350.com. Browsers that installed the old app at /cookbook/ still run its service
// worker, which would keep showing the old saved copy. This replacement removes that copy and sends them to On350.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      const path = new URL(client.url).pathname.replace(/^\/cookbook\/?/, '/');
      client.navigate('https://on350.com' + path);
    }
  })());
});
