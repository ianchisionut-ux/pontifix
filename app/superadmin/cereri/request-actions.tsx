'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export default function RequestActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateStatus(newStatus: string) {
    setLoading(true)
    try {
      await fetchWithTimeout(`/api/superadmin/access-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2 mt-2">
      {status !== 'CONTACTED' && (
        <button onClick={() => updateStatus('CONTACTED')} disabled={loading} className="text-xs text-[var(--accent)] font-medium">
          Marchează contactată
        </button>
      )}
      {status !== 'CONVERTED' && (
        <button onClick={() => updateStatus('CONVERTED')} disabled={loading} className="text-xs text-green-700 font-medium">
          Marchează convertită
        </button>
      )}
      {status !== 'DISMISSED' && (
        <button onClick={() => updateStatus('DISMISSED')} disabled={loading} className="text-xs text-red-600 font-medium">
          Respinge
        </button>
      )}
    </div>
  )
}
