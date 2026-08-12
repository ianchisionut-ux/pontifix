'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export default function AccessRequestForm() {
  const [form, setForm] = useState({ name: '', businessName: '', email: '', phone: '', category: 'SALON', message: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetchWithTimeout('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare.')
        return
      }
      setDone(true)
    } catch {
      setError('Conexiune eșuată. Încearcă din nou, sau scrie-ne direct.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="card p-6 text-center">
        <p className="font-medium mb-1">Mulțumim!</p>
        <p className="text-sm text-gray-600">
          Am primit cererea ta. Te contactăm în cel mai scurt timp ca să-ți configurăm contul.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card p-6 flex flex-col gap-3 text-left">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input placeholder="Numele tău" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <Input placeholder="Numele afacerii" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <Input type="tel" inputMode="tel" placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
      </div>
      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field w-full">
        <option value="SALON">Salon</option>
        <option value="EVENT_VENUE">Spații evenimente</option>
        <option value="CLINICA">Clinică medicală/stomatologică</option>
      </select>
      <textarea
        placeholder="Spune-ne câte ceva despre afacerea ta (opțional)"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        className="input-field w-full min-h-[80px]"
        maxLength={1000}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Se trimite...' : 'Cere acces'}
      </Button>
    </form>
  )
}
