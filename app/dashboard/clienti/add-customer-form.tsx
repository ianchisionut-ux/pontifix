'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Card } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function AddCustomerForm({ isClinic = false }: { isClinic?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    allergies: '',
    medicalNotes: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetchWithTimeout('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare.')
        return
      }
      setForm({ name: '', phone: '', email: '', dateOfBirth: '', allergies: '', medicalNotes: '' })
      setOpen(false)
      router.refresh()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + Adaugă {isClinic ? 'pacient' : 'client'}
      </Button>
    )
  }

  return (
    <Card className="mb-5 max-w-md w-full">
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input placeholder="Nume" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input placeholder="Email (opțional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {isClinic && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Data nașterii</label>
              <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </div>
          )}
        </div>

        {isClinic && (
          <>
            <Input
              placeholder="Alergii cunoscute (ex: penicilină, latex...)"
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
            />
            <Textarea
              placeholder="Istoric medical / afecțiuni cunoscute (opțional)"
              value={form.medicalNotes}
              onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })}
              className="min-h-[70px]"
            />
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSave} disabled={saving || !form.phone}>
            {saving ? 'Se salvează...' : 'Salvează'}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Anulează
          </Button>
        </div>
      </div>
    </Card>
  )
}
