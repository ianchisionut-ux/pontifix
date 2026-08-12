'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { CardInteractive, Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Service = { id: string; name: string; durationMin: number | null; price: number | null; active: boolean }
type Resource = { id: string; name: string; capacity: number | null; basePrice: number | null }

export default function ServicesManager({
  category,
  services,
  resources,
}: {
  category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'
  services: Service[]
  resources: Resource[]
}) {
  const isSalon = category === 'SALON' || category === 'CLINICA'
  const router = useRouter()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', durationMin: '', price: '', capacity: '' })
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', durationMin: '', price: '', capacity: '' })
  const [saving, setSaving] = useState(false)

  const endpoint = isSalon ? '/api/business/services' : '/api/business/resources'
  const items = isSalon ? services : resources

  function startEdit(item: Service | Resource) {
    setEditingId(item.id)
    setDraft({
      name: item.name,
      durationMin: isSalon ? String((item as Service).durationMin ?? '') : '',
      price: isSalon ? String((item as Service).price ?? '') : String((item as Resource).basePrice ?? ''),
      capacity: !isSalon ? String((item as Resource).capacity ?? '') : '',
    })
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const payload = isSalon
      ? { name: draft.name, durationMin: draft.durationMin ? Number(draft.durationMin) : null, price: draft.price ? Number(draft.price) : null }
      : { name: draft.name, capacity: draft.capacity ? Number(draft.capacity) : null, basePrice: draft.price ? Number(draft.price) : null }

    try {
      await fetchWithTimeout(`${endpoint}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setEditingId(null)
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Ștergi definitiv acest element?')) return
    try {
      await fetchWithTimeout(`${endpoint}/${id}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  async function createItem() {
    if (!newItem.name.trim()) return
    setSaving(true)
    const payload = isSalon
      ? { name: newItem.name, durationMin: newItem.durationMin ? Number(newItem.durationMin) : null, price: newItem.price ? Number(newItem.price) : null }
      : { name: newItem.name, capacity: newItem.capacity ? Number(newItem.capacity) : null, basePrice: newItem.price ? Number(newItem.price) : null }

    try {
      await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setNewItem({ name: '', durationMin: '', price: '', capacity: '' })
      setAdding(false)
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
        <h1 className="text-2xl font-semibold">{isSalon ? 'Servicii' : 'Săli'}</h1>
        <Button onClick={() => setAdding((v) => !v)}>{adding ? 'Anulează' : `+ Adaugă ${isSalon ? 'serviciu' : 'sală'}`}</Button>
      </div>
      <p className="text-sm text-gray-500 mb-6">{items.length} {isSalon ? 'servicii' : 'săli'}</p>

      {adding && (
        <Card className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <Input placeholder={isSalon ? 'Numele serviciului' : 'Numele sălii'} value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
            {isSalon ? (
              <Input type="number" placeholder="Durată (min)" value={newItem.durationMin} onChange={(e) => setNewItem({ ...newItem, durationMin: e.target.value })} />
            ) : (
              <Input type="number" placeholder="Capacitate" value={newItem.capacity} onChange={(e) => setNewItem({ ...newItem, capacity: e.target.value })} />
            )}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input type="number" placeholder="Preț (lei)" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
            <Button variant="secondary" onClick={createItem} disabled={saving}>
              Salvează
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3">
        {items.map((item) => (
          <CardInteractive key={item.id}>
            {editingId === item.id ? (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  {isSalon ? (
                    <Input type="number" placeholder="Durată (min)" value={draft.durationMin} onChange={(e) => setDraft({ ...draft, durationMin: e.target.value })} />
                  ) : (
                    <Input type="number" placeholder="Capacitate" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} />
                  )}
                </div>
                <div className="flex gap-2">
                  <Input type="number" placeholder="Preț (lei)" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
                  <Button variant="secondary" onClick={() => saveEdit(item.id)} disabled={saving}>
                    Salvează
                  </Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)}>
                    Anulează
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm text-gray-500">
                    {isSalon ? (
                      <>
                        <p>{(item as Service).durationMin ? `${(item as Service).durationMin} min` : '—'}</p>
                        <p className="font-medium text-gray-900">{(item as Service).price ? `${(item as Service).price} lei` : ''}</p>
                      </>
                    ) : (
                      <>
                        <p>{(item as Resource).capacity ? `${(item as Resource).capacity} persoane` : '—'}</p>
                        <p className="font-medium text-gray-900">{(item as Resource).basePrice ? `${(item as Resource).basePrice} lei` : '—'}</p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(item)} className="text-xs text-[var(--accent)] font-medium">
                      Editează
                    </button>
                    <button onClick={() => deleteItem(item.id)} className="text-xs text-red-600 font-medium">
                      Șterge
                    </button>
                  </div>
                </div>
              </div>
            )}
          </CardInteractive>
        ))}
        {items.length === 0 && !adding && (
          <p className="text-sm text-gray-500">Niciun {isSalon ? 'serviciu' : 'sală'} adăugat încă.</p>
        )}
      </div>
    </div>
  )
}
