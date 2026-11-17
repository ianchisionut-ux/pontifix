'use client'

import { useEffect } from 'react'

// Keep the unread count in the PWA navigation without showing chat notifications.
// The Windows desktop application handles incoming-message popups itself.
export function InternalChatNotifier() {
  useEffect(() => {
    if ((window as Window & { elmontDesktop?: boolean }).elmontDesktop) return
    let cancelled = false

    async function refreshUnread() {
      try {
        const response = await fetch('/api/internal-chat/notifications', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json() as { unreadCount: number }
        if (!cancelled && Number.isFinite(data.unreadCount)) {
          window.dispatchEvent(new CustomEvent('internal-chat-unread', { detail: data.unreadCount }))
        }
      } catch { /* Retry on the next interval. */ }
    }

    const firstPoll = setTimeout(refreshUnread, 1200)
    const timer = setInterval(refreshUnread, 10000)
    return () => { cancelled = true; clearTimeout(firstPoll); clearInterval(timer) }
  }, [])

  return null
}
