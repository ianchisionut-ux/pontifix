'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CardInteractive } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type Ticket = {
  id: string
  businessId: string
  businessName: string
  subject: string
  message: string
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
  reply: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Nou',
  IN_PROGRESS: 'În lucru',
  RESOLVED: 'Rezolvat',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  NEW: 'warning',
  IN_PROGRESS: 'neutral',
  RESOLVED: 'success',
}

export default function TicketsManager({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Tichete suport</h1>
      <p className="text-sm text-gray-500 mb-6">{tickets.length} tichete, de la administratorii afacerilor.</p>

      <div className="flex flex-col gap-3">
        {tickets.map((t) => (
          <CardInteractive key={t.id} onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{t.subject}</p>
                <p className="text-sm text-gray-500">
                  {t.businessName} · {new Date(t.createdAt).toLocaleDateString('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' })}
                </p>
              </div>
              <Pill tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Pill>
            </div>

            {expandedId === t.id && (
              <div onClick={(e) => e.stopPropagation()} className="mt-4 pt-4 border-t border-[var(--border-soft)]">
                <TicketDetail ticket={t} onSaved={() => router.refresh()} />
              </div>
            )}
          </CardInteractive>
        ))}
        {tickets.length === 0 && <p className="text-sm text-gray-500">Niciun tichet încă.</p>}
      </div>
    </div>
  )
}

function TicketDetail({ ticket, onSaved }: { ticket: Ticket; onSaved: () => void }) {
  const [status, setStatus] = useState(ticket.status)
  const [reply, setReply] = useState(ticket.reply ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await fetchWithTimeout(`/api/superadmin/support-tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reply: reply.trim() || undefined }),
      })
      onSaved()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>

      <a href={`/superadmin/afaceri/${ticket.businessId}`} className="text-xs text-[var(--accent)] underline w-fit">
        Vezi afacerea
      </a>

      <div>
        <label className="text-sm text-gray-500 block mb-1.5">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as Ticket['status'])} className="input-field w-full">
          <option value="NEW">Nou</option>
          <option value="IN_PROGRESS">În lucru</option>
          <option value="RESOLVED">Rezolvat</option>
        </select>
      </div>

      <div>
        <label className="text-sm text-gray-500 block mb-1.5">Răspuns (opțional, vizibil adminului afacerii)</label>
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} className="input-field w-full min-h-[80px]" />
      </div>

      <button onClick={save} disabled={saving} className="btn-primary self-start">
        {saving ? 'Se salvează...' : 'Salvează'}
      </button>
    </div>
  )
}
