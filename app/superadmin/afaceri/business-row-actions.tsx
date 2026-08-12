'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export default function BusinessRowActions({
  businessId,
  businessName,
  publicListed,
}: {
  businessId: string
  businessName: string
  publicListed: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    try {
      await fetchWithTimeout(`/api/superadmin/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicListed: !publicListed }),
      })
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  async function remove() {
    const confirmation = prompt(`Această acțiune e ireversibilă. Scrie "${businessName}" pentru confirmare:`)
    if (confirmation !== businessName) return
    setLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/superadmin/businesses/${businessId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Ștergerea a eșuat.')
        return
      }
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={toggle} disabled={loading} className="text-xs text-[var(--accent)] font-medium">
        {publicListed ? 'Ascunde' : 'Afișează'}
      </button>
      <button onClick={remove} disabled={loading} className="text-xs text-red-600 font-medium">
        Șterge
      </button>
    </div>
  )
}
