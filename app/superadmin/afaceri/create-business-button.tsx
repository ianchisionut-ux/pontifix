'use client'

import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function CreateBusinessButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ slug: '', name: '', email: '', category: 'SALON' as 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const res = await fetchWithTimeout('/api/superadmin/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Verifică datele completate.')
        return
      }
      setOpen(false)
      setForm({ slug: '', name: '', email: '', category: 'SALON' })
      router.push(`/superadmin/afaceri/${data.business.id}`)
    } catch (err) {
      setError('Conexiune eșuată. Verifică internetul și încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Creează afacere</Button>
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="font-medium mb-1">Creează afacere nouă</h2>
        <p className="text-sm text-gray-500 mb-4">
          Clientul primește un email cu link de configurare a parolei — nu introduci tu parola.
        </p>

        <div className="flex flex-col gap-2">
          <Input placeholder="Slug (ex: salon-bella)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <Input placeholder="Nume afacere" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA' })}
            className="input-field"
          >
            <option value="SALON">Salon</option>
            <option value="EVENT_VENUE">Spații evenimente</option>
            <option value="CLINICA">Clinică medicală/stomatologică</option>
            <option value="HOTEL">Hotel (în dezvoltare, nu apare public)</option>
            <option value="PENSIUNE">Pensiune (în dezvoltare, nu apare public)</option>
          </select>
          <Input placeholder="Email owner" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <Button variant="secondary" onClick={submit} disabled={saving}>
            {saving ? 'Se creează...' : 'Creează și trimite email'}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Anulează
          </Button>
        </div>
      </Card>
    </div>
  )
}
