'use client'

import { useEffect } from 'react'

export function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (window.location.hostname === 'sms.elmont.ro') return
      const chat = window.location.hostname === 'chat.elmont.ro'
      navigator.serviceWorker.register(chat ? '/chat-sw.js' : '/internal-chat-sw.js', { scope: chat ? '/chat' : '/' }).catch(() => undefined)
    }
  }, [])
  return null
}
