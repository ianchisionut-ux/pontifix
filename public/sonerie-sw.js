self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch {}
  if (payload.type !== 'sonerie') return
  event.waitUntil((async () => {
    // Un apel expirat nu mai trebuie să sune când Android livrează push-ul târziu.
    if (!payload.expiresAt || Date.now() < Date.parse(payload.expiresAt)) {
      await self.registration.showNotification(payload.title || 'Directorul te cheamă', {
        body: payload.body || 'Te rog să vii la birou.',
        icon: '/sonerie-icon-192.png',
        badge: '/sonerie-icon-192.png',
        tag: `sonerie-${payload.id || 'nou'}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [180, 100, 180],
        data: { url: '/sonerie' },
      })
    }
    if (payload.id) {
      try {
        await fetch('/api/sonerie/delivery', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: payload.id }),
        })
      } catch { /* Telefonul poate fi offline; chemarea rămâne vizibilă la redeschidere. */ }
    }
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).pathname.startsWith('/sonerie'))
    if (existing) return existing.focus()
    return clients.openWindow('/sonerie')
  }))
})
