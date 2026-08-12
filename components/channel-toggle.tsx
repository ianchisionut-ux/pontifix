'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ChannelToggle({ channelId, enabled }: { channelId: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    const next = !on
    setOn(next)
    try {
      await fetch(`/api/business/channels/${channelId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledByOwner: next }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="pill w-11 h-6 flex items-center px-0.5 transition disabled:opacity-50"
      style={{ background: on ? 'var(--accent)' : '#e5e5ea' }}
    >
      <span
        className="pill w-5 h-5 bg-white transition-transform"
        style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  )
}
