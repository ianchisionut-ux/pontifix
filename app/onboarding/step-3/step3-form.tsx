'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { OnboardingProgress } from '@/components/onboarding-progress'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Item = { name: string; durationMin?: string; price?: string; capacity?: string }

export default function Step3Form({ category }: { category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA' }) {
  const router = useRouter()
  const isSalon = category === 'SALON' || category === 'CLINICA'
  const [items, setItems] = useState<Item[]>([])
  const [draft, setDraft] = useState<Item>({ name: '', durationMin: '', price: '', capacity: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addItem() {
    if (!draft.name.trim()) return
    setItems((prev) => [...prev, draft])
    setDraft({ name: '', durationMin: '', price: '', capacity: '' })
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    const services = items.map((i) => ({
      name: i.name,
      durationMin: isSalon && i.durationMin ? Number(i.durationMin) : null,
      price: i.price ? Number(i.price) : null,
      capacity: !isSalon && i.capacity ? Number(i.capacity) : null,
    }))

    try {
      await fetchWithTimeout('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 3, data: { services } }),
      })
      router.push('/onboarding/step-5')
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
      setLoading(false)
    }
  }

  return (
    <Card>
      <OnboardingProgress step={3} />
      <p className="text-xs text-gray-500 mb-1">Pasul 3 din 4</p>
      <h1 className="text-xl font-semibold mb-1">{isSalon ? 'Ce servicii oferi?' : 'Ce săli ai disponibile?'}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {isSalon
          ? 'Adaugă serviciile ca botul să poată propune programări — sau sari peste, le adaugi oricând mai târziu din Servicii.'
          : 'Adaugă cel puțin o sală, cu capacitatea și prețul ei.'}
      </p>

      {items.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {items.map((item, i) => (
            <div key={i} className="border border-[var(--border-soft)] rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {isSalon
                    ? `${item.durationMin || '—'} min · ${item.price || '—'} lei`
                    : `${item.capacity || '—'} persoane · ${item.price || '—'} lei`}
                </p>
              </div>
              <button onClick={() => removeItem(i)} className="text-gray-400 text-xs">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-[var(--border-soft)] p-4">
        <p className="text-sm font-medium mb-2.5">{isSalon ? 'Adaugă serviciu' : 'Adaugă sală'}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <Input
            placeholder={isSalon ? 'Numele serviciului' : 'Numele sălii'}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          {isSalon ? (
            <Input
              type="number"
              placeholder="Durată (min)"
              value={draft.durationMin}
              onChange={(e) => setDraft({ ...draft, durationMin: e.target.value })}
            />
          ) : (
            <Input
              type="number"
              placeholder="Capacitate (persoane)"
              value={draft.capacity}
              onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
            />
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            type="number"
            placeholder="Preț (lei)"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
          <Button type="button" variant="secondary" onClick={addItem}>
            + Adaugă
          </Button>
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={() => router.push('/onboarding/step-2')}>
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
