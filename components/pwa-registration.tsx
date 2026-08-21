'use client'

import { useEffect } from 'react'

export function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/internal-chat-sw.js', { scope: '/' }).catch(() => undefined)
    }
  }, [])
  return null
}
