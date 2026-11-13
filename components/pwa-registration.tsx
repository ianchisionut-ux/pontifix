'use client'

import { useEffect } from 'react'

export function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (window.location.hostname === 'sms.elmont.ro') return
      const worker = window.location.hostname === 'chat.elmont.ro' ? '/chat-sw.js' : '/internal-chat-sw.js'
      navigator.serviceWorker.register(worker, { scope: '/' }).catch(() => undefined)
    }
  }, [])
  return null
}
