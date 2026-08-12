'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type EligibleBooking = { id: string; serviceName: string; date: string }

export default function ReviewForm({ slug }: { slug: string }) {
  const [step, setStep] = useState<'PHONE' | 'PICK' | 'RATE' | 'DONE'>('PHONE')
  const [phone, setPhone] = useState('')
  const [bookings, setBookings] = useState<EligibleBooking[]>([])
  const [selected, setSelected] = useState<EligibleBooking | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/public/reviews?slug=${slug}&phone=${encodeURIComponent(phone)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare.')
        return
      }
      if (data.bookings.length === 0) {
        setError('Nu am găsit nicio programare finalizată, nerecenzată, pe acest număr.')
        return
      }
      setBookings(data.bookings)
      if (data.bookings.length === 1) {
        setSelected(data.bookings[0])
        setStep('RATE')
      } else {
        setStep('PICK')
      }
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    if (!selected) return
    setError('')
    setLoading(true)
    try {
      const res = await fetchWithTimeout('/api/public/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: selected.id, phone, rating, comment }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare.')
        return
      }
      setStep('DONE')
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'DONE') {
    return (
      <Card>
        <p className="text-sm text-green-700">Mulțumim! Recenzia ta a fost publicată.</p>
      </Card>
    )
  }

  if (step === 'PICK') {
    return (
      <Card>
        <p className="text-sm text-gray-500 mb-3">Ai mai multe programări finalizate — pentru care lași recenzia?</p>
        <div className="flex flex-col gap-2">
          {bookings.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setSelected(b)
                setStep('RATE')
              }}
              className="card card-interactive text-left p-3"
            >
              <p className="font-medium">{b.serviceName}</p>
              <p className="text-xs text-gray-500">{new Date(b.date).toLocaleDateString('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' })}</p>
            </button>
          ))}
        </div>
      </Card>
    )
  }

  if (step === 'RATE' && selected) {
    return (
      <Card>
        <p className="text-sm text-gray-500 mb-1">Recenzie pentru</p>
        <p className="font-medium mb-4">
          {selected.serviceName} · {new Date(selected.date).toLocaleDateString('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' })}
        </p>

        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className="text-3xl leading-none"
              style={{ color: n <= rating ? '#eab308' : '#d1d5db' }}
              aria-label={`${n} stele`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Scrie câteva cuvinte (opțional)..."
          className="input-field w-full min-h-[100px] mb-3"
          maxLength={1000}
        />

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

        <Button onClick={submit} disabled={loading}>
          {loading ? 'Se trimite...' : 'Trimite recenzia'}
        </Button>
      </Card>
    )
  }

  return (
    <Card>
      <p className="text-sm text-gray-500 mb-3">
        Introdu numărul de telefon folosit la rezervare, ca să găsim programarea ta finalizată.
      </p>
      <form onSubmit={lookup} className="flex flex-col gap-3">
        <Input type="tel" inputMode="tel" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? 'Se caută...' : 'Continuă'}
        </Button>
      </form>
    </Card>
  )
}
