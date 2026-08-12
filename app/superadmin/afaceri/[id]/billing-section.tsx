'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

const STATUS_LABEL: Record<string, string> = {
  GRATUIT: 'Gratuit (demo)',
  NEPLATIT: 'Neplătit',
  PLATIT: 'Plătit',
  RESTANT: 'Restant',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  GRATUIT: 'neutral',
  NEPLATIT: 'warning',
  PLATIT: 'success',
  RESTANT: 'danger',
}

export default function BillingSection({
  businessId,
  initialPlanName,
  initialStatus,
  initialNote,
}: {
  businessId: string
  initialPlanName: string | null
  initialStatus: string
  initialNote: string | null
}) {
  const router = useRouter()
  const [planName, setPlanName] = useState(initialPlanName ?? '')
  const [status, setStatus] = useState(initialStatus)
  const [note, setNote] = useState(initialNote ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await fetchWithTimeout(`/api/superadmin/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName: planName || null, billingStatus: status, billingNote: note || null }),
      })
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Abonament</h2>
        <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Gestionat manual până se configurează plata online recurentă. Nu blochează automat nimic —
        activarea/dezactivarea contului rămâne separat, mai sus.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Plan</label>
          <Input placeholder="ex: Standard, Pro..." value={planName} onChange={(e) => setPlanName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Status plată</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field w-full">
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="text-sm text-gray-500 block mb-1.5">Notă (opțional)</label>
      <Input placeholder="ex: plătit cash august, factură #123..." value={note} onChange={(e) => setNote(e.target.value)} className="mb-3" />

      <Button variant="secondary" onClick={save} disabled={saving}>
        {saving ? 'Se salvează...' : 'Salvează'}
      </Button>
    </Card>
  )
}
