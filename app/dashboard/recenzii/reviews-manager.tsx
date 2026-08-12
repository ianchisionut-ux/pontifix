'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Star, CheckCircle2 } from 'lucide-react'

type Review = {
  id: string
  authorName: string
  rating: number
  comment: string | null
  reply: string | null
  createdAt: string
  verified: boolean
  source: string
}

function ReplyBox({ review }: { review: Review }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(review.reply ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(review.reply)

  async function save() {
    setSaving(true)
    try {
      const res = await fetchWithTimeout(`/api/business/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: text || null }),
      })
      if (res.ok) {
        setSaved(text || null)
        setEditing(false)
      } else {
        alert('Nu am putut salva răspunsul.')
      }
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="mt-2">
        {saved && (
          <div className="pl-3 border-l-2 border-[var(--border-soft)] mb-2">
            <p className="text-xs font-medium text-gray-500 mb-0.5">Răspunsul tău</p>
            <p className="text-sm text-gray-600">{saved}</p>
          </div>
        )}
        <button onClick={() => setEditing(true)} className="text-xs text-[var(--accent)] font-medium">
          {saved ? 'Editează răspunsul' : '+ Răspunde'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Scrie un răspuns public..."
        className="input-field w-full min-h-[70px] text-sm mb-2"
        maxLength={1000}
      />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-secondary text-xs py-1.5 px-3">
          {saving ? 'Se salvează...' : 'Salvează'}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-gray-500">
          Anulează
        </button>
      </div>
    </div>
  )
}

export default function ReviewsManager({
  rating,
  reviewCount,
  reviews,
  googleConnected,
}: {
  rating: number | null
  reviewCount: number
  reviews: Review[]
  googleConnected: boolean
}) {
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  async function syncGoogle() {
    setSyncing(true)
    setSyncMessage('')
    try {
      const res = await fetchWithTimeout('/api/business/reviews/sync-google', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSyncMessage(data.error ?? 'Sincronizarea a eșuat.')
        return
      }
      setSyncMessage(`${data.synced} recenzii sincronizate. Reîncarcă pagina ca să le vezi.`)
    } catch {
      setSyncMessage('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h1 className="text-2xl font-semibold">Recenzii</h1>
        {googleConnected && (
          <button onClick={syncGoogle} disabled={syncing} className="btn-secondary text-sm whitespace-nowrap">
            {syncing ? 'Se sincronizează...' : 'Sincronizează cu Google'}
          </button>
        )}
      </div>
      {syncMessage && <p className="text-xs text-gray-500 mb-2">{syncMessage}</p>}
      <p className="text-sm text-gray-500 mb-6 flex items-center gap-1">
        {rating ? (
          <>
            <Star size={13} fill="#eab308" color="#eab308" /> {rating.toFixed(1)} · {reviewCount} recenzii
          </>
        ) : (
          'Nicio recenzie încă'
        )}
      </p>

      <div className="flex flex-col gap-3">
        {reviews.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium flex items-center gap-1.5">
                {r.authorName}
                {r.verified && (
                  <span className="text-xs text-green-700 font-normal flex items-center gap-1">
                    <CheckCircle2 size={12} /> client verificat
                  </span>
                )}
                {r.source === 'google' && (
                  <span className="text-xs text-gray-500 font-normal px-1.5 py-0.5 rounded-full border border-[var(--border-soft)]">
                    Google
                  </span>
                )}
              </p>
              <p className="flex gap-0.5" style={{ color: '#eab308' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} fill={i < r.rating ? '#eab308' : 'none'} color={i < r.rating ? '#eab308' : '#d1d5db'} />
                ))}
              </p>
            </div>
            {r.comment && <p className="text-sm text-gray-600 mb-1">{r.comment}</p>}
            <p className="text-xs text-gray-400">
              {new Date(r.createdAt).toLocaleDateString('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' })}
            </p>
            <ReplyBox review={r} />
          </Card>
        ))}
        {reviews.length === 0 && <p className="text-sm text-gray-500">Nicio recenzie încă.</p>}
      </div>
    </div>
  )
}
