self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))
self.addEventListener('fetch', () => {})
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch {}
  if (payload.type !== 'internal-chat') return
  event.waitUntil(self.registration.showNotification(payload.title || 'Mesaj nou în Chat Elmont', {
    body: payload.body || 'Ai primit un mesaj nou.',
    icon: '/chat-icon-192.png', badge: '/chat-icon-192.png',
    tag: `internal-chat-${payload.id || 'nou'}`, requireInteraction: true,
    data: { url: '/chat' },
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/chat'
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ('focus' in client) { client.navigate(target); return client.focus() }
    }
    return clients.openWindow(target)
  }))
})
