// Phone notifications: shown by the service worker, so they arrive even when On350 is closed.
// Loaded into the generated service worker (see vite.config.ts, workbox.importScripts).
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'On350', body: event.data ? event.data.text() : '' } }
  const timer = data.kind === 'timer'
  event.waitUntil((async () => {
    if (timer) {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // The app is open on screen and already ringing: no need for a second alert.
      if (open.some((c) => c.visibilityState === 'visible')) return
    }
    await self.registration.showNotification(data.title || 'On350', {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    requireInteraction: timer,
    vibrate: timer ? [300, 150, 300, 150, 600] : [120],
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-64.png',
    data: { url: data.url || '/' },
  })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of all) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus()
        if ('navigate' in client && url !== '/') await client.navigate(url).catch(() => undefined)
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})
