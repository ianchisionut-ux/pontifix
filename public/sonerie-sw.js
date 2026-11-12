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
  event.waitUntil(self.registration.showNotification(payload.title || 'Directorul te cheamă', {
    body: payload.body || 'Te rog să vii la birou.',
    icon: '/sonerie-icon-192.png',
    badge: '/sonerie-icon-192.png',
    tag: `sonerie-${payload.id || 'nou'}`,
    renotify: true,
    requireInteraction: true,
    data: { url: '/sonerie' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).pathname.startsWith('/sonerie'))
    if (existing) return existing.focus()
    return clients.openWindow('/sonerie')
  }))
})
