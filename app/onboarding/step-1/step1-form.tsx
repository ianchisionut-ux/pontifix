'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { OnboardingProgress } from '@/components/onboarding-progress'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const CATEGORY_LABEL: Record<string, string> = {
  SALON: 'Salon',
  EVENT_VENUE: 'Spații evenimente',
  HOTEL: 'Hotel',
  PENSIUNE: 'Pensiune',
  CLINICA: 'Clinică medicală/stomatologică',
}

// doar aceste două categorii se pot alege chiar aici, în onboarding — restul (Clinică,
// Hotel, Pensiune) sunt stabilite de admin la crearea contului și nu se schimbă aici,
// ca să nu riști să strici din greșeală o categorie deja setată corect
const SELECTABLE = ['SALON', 'EVENT_VENUE']

export default function Step1Form({ currentCategory }: { currentCategory: string }) {
  const router = useRouter()
  const categoryIsFixed = !SELECTABLE.includes(currentCategory)

  const [form, setForm] = useState({
    name: '',
    category: (SELECTABLE.includes(currentCategory) ? currentCategory : 'SALON') as 'SALON' | 'EVENT_VENUE',
    contactPhone: '',
    city: '',
    address: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetchWithTimeout('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // dacă e o categorie fixă (Clinică etc.), nu trimitem deloc categoria — rămâne
        // exact ce a setat admin-ul, ca să nu fie suprascrisă din greșeală
        body: JSON.stringify({ step: 1, data: categoryIsFixed ? { ...form, category: undefined } : form }),
      })

      if (!res.ok) {
        setError('Verifică datele completate.')
        return
      }

      router.push('/onboarding/step-2')
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <OnboardingProgress step={1} />
      <p className="text-xs text-gray-500 mb-1">Pasul 1 din 4</p>
      <h1 className="text-xl font-semibold mb-1">Spune-ne despre afacerea ta</h1>
      <p className="text-sm text-gray-500 mb-6">
        Aceste informații apar pe pagina ta publică și în conversațiile cu clienții.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Nume afacere</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Salon Bella"
            required
          />
        </div>

        {categoryIsFixed ? (
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Tip de afacere</label>
            <div className="rounded-2xl p-4 border border-[var(--border-soft)] bg-[var(--surface-muted)]">
              <p className="text-sm font-medium">{CATEGORY_LABEL[currentCategory] ?? currentCategory}</p>
              <p className="text-xs text-gray-500 mt-0.5">Stabilit la crearea contului — pentru schimbare, contactează-ne.</p>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-sm text-gray-500 block mb-2">Tip de afacere</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, category: 'SALON' })}
                className="rounded-2xl p-4 text-left transition"
                style={{
                  border: form.category === 'SALON' ? '2px solid var(--accent)' : '1px solid var(--border-soft)',
                  background: form.category === 'SALON' ? 'var(--accent-soft)' : 'white',
                }}
              >
                <p className="text-sm font-medium" style={{ color: form.category === 'SALON' ? 'var(--accent)' : undefined }}>
                  Salon
                </p>
                <p className="text-xs text-gray-500">frizerie, unghii, coafor</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, category: 'EVENT_VENUE' })}
                className="rounded-2xl p-4 text-left transition"
                style={{
                  border: form.category === 'EVENT_VENUE' ? '2px solid var(--accent)' : '1px solid var(--border-soft)',
                  background: form.category === 'EVENT_VENUE' ? 'var(--accent-soft)' : 'white',
                }}
              >
                <p
                  className="text-sm font-medium"
                  style={{ color: form.category === 'EVENT_VENUE' ? 'var(--accent)' : undefined }}
                >
                  Spații evenimente
                </p>
                <p className="text-xs text-gray-500">săli, nunți, corporate</p>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Telefon contact</label>
            <Input
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              placeholder="07XX XXX XXX"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Oraș</label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Adresă (opțional, pentru hartă)</label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end mt-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Se salvează...' : 'Continuă →'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
