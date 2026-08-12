'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { OnboardingProgress } from '@/components/onboarding-progress'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Time10Select } from '@/components/working-date-time-picker'

const WEEKDAY_LABELS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']

type WorkingHour = { weekday: number; startTime: string; endTime: string; closed: boolean }

const DEFAULT_HOURS: WorkingHour[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startTime: '09:00',
  endTime: '18:00',
  closed: weekday === 0,
}))

export default function OnboardingStep2() {
  const router = useRouter()
  const [hours, setHours] = useState(DEFAULT_HOURS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateHour(weekday: number, patch: Partial<WorkingHour>) {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)))
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    const workingHours = hours
      .filter((h) => !h.closed)
      .map((h) => ({ weekday: h.weekday, startTime: h.startTime, endTime: h.endTime }))

    try {
      await fetchWithTimeout('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2, data: { workingHours } }),
      })
      router.push('/onboarding/step-3')
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
      setLoading(false)
    }
  }

  return (
    <Card>
      <OnboardingProgress step={2} />
      <p className="text-xs text-gray-500 mb-1">Pasul 2 din 4</p>
      <h1 className="text-xl font-semibold mb-1">Care e programul tău?</h1>
      <p className="text-sm text-gray-500 mb-6">Botul va propune clienților doar sloturi din acest program.</p>

      <div className="flex flex-col gap-2">
        {hours.map((h) => (
          <div key={h.weekday} className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm py-1">
            <span className="w-20 sm:w-24 text-gray-600 shrink-0">{WEEKDAY_LABELS[h.weekday]}</span>
            <label className="flex items-center gap-1.5 text-gray-500 shrink-0">
              <input type="checkbox" checked={!h.closed} onChange={(e) => updateHour(h.weekday, { closed: !e.target.checked })} />
              deschis
            </label>
            {!h.closed && (
              <div className="flex items-center gap-2 shrink-0">
                <Time10Select value={h.startTime} onChange={(value) => updateHour(h.weekday, { startTime: value })} />
                <span className="text-gray-400">–</span>
                <Time10Select value={h.endTime} onChange={(value) => updateHour(h.weekday, { endTime: value })} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={() => router.push('/onboarding/step-1')}>
          ← Înapoi
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Se salvează...' : 'Continuă →'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 mt-3 text-right">{error}</p>}
    </Card>
  )
}
