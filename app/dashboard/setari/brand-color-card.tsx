'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

const PRESET_COLORS = [
  '#0f9b6c', // verde
  '#0d6e6e', // teal închis
  '#0e9aa7', // teal
  '#2563eb', // albastru
  '#7c3aed', // violet
  '#db2777', // roz
  '#dc2626', // roșu
  '#ea580c', // portocaliu
]

export default function BrandColorCard({ initialColor, usesAppointments }: { initialColor: string | null; usesAppointments: boolean }) {
  const router = useRouter()
  const [color, setColor] = useState<string | null>(initialColor)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  async function save(newColor: string | null) {
    const previous = color
    setColor(newColor)
    setSaving(true)
    try {
      const res = await fetchWithTimeout('/api/business/brand-color', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandColor: newColor }),
      })
      if (!res.ok) {
        setColor(previous) // revenim vizual dacă salvarea chiar eșuează
        alert('Nu am putut salva culoarea. Încearcă din nou.')
        return
      }
      setSavedAt(Date.now())
      router.refresh()
    } catch {
      setColor(previous)
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-5 break-inside-avoid">
      <h2 className="font-medium mb-1">Culoarea profilului tău</h2>
      <p className="text-sm text-gray-500 mb-4">
        Se aplică pe pagina publică și pe formularul de {usesAppointments ? 'programare' : 'rezervare'} — servicii selectate, date, ore, buton de confirmare.
      </p>

      <div className="flex flex-wrap gap-2.5 mb-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => save(c)}
            aria-label={c}
            className="w-9 h-9 rounded-full transition"
            style={{
              background: c,
              boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
            }}
          />
        ))}
        <button
          onClick={() => save(null)}
          aria-label="Implicit Pontifix"
          className="w-9 h-9 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400 font-medium"
          style={{
            boxShadow: !color ? '0 0 0 2px white, 0 0 0 4px var(--accent)' : 'none',
          }}
        >
          Def.
        </button>
      </div>

      {saving && <p className="text-xs text-gray-400">Se salvează...</p>}
      {!saving && savedAt && <p className="text-xs text-green-700">Salvat!</p>}
    </Card>
  )
}
