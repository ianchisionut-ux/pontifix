'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type FormState = {
  name: string
  phone: string
  email: string
  notes: string
  dateOfBirth: string
  allergies: string
  medicalNotes: string
}

export default function CustomerEditForm({
  customerId,
  initial,
  isClinic,
}: {
  customerId: string
  initial: FormState
  isClinic: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetchWithTimeout(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare.')
        return
      }
      setSavedAt(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' }))
      router.refresh()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Nume</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fără nume" />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Telefon</label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Email</label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        {isClinic && (
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Data nașterii</label>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          </div>
        )}
      </div>

      {isClinic && (
        <>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Alergii cunoscute</label>
            <Input
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              placeholder="Ex: penicilină, latex..."
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Istoric medical / afecțiuni cunoscute</label>
            <Textarea
              value={form.medicalNotes}
              onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })}
              placeholder="Ex: diabet, hipertensiune, tratamente în curs..."
              className="min-h-[80px]"
            />
          </div>
        </>
      )}

      <div>
        <label className="text-sm text-gray-500 block mb-1.5">Notițe interne</label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder={isClinic ? 'Ex: preferă programări dimineața...' : 'Ex: preferă programări dimineața, alergic la anumite produse...'}
          className="min-h-[80px]"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? 'Se salvează...' : 'Salvează modificările'}
        </Button>
        {savedAt && <span className="text-xs text-gray-500">Salvat la {savedAt}</span>}
      </div>
    </div>
  )
}
