'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, X, CheckCircle2, Clock } from 'lucide-react'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type Ticket = {
  id: string
  subject: string
  message: string
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
  reply: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = { NEW: 'Nou', IN_PROGRESS: 'În lucru', RESOLVED: 'Rezolvat' }

// panoul propriu-zis, controlat din exterior (open/onClose) — poate fi declanșat de
// orice trigger (buton flotant, link din bara de cont, etc.), nu mai are propriul buton
export function SupportChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<'list' | 'new'>('list')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setLoadingTickets(true)
    fetchWithTimeout('/api/business/support-tickets')
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets ?? []))
      .catch(() => setTickets([]))
      .finally(() => setLoadingTickets(false))
  }, [open])

  async function submit() {
    if (subject.trim().length < 2 || message.trim().length < 5) {
      setError('Completează subiectul și un mesaj cu detalii.')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await fetchWithTimeout('/api/business/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Nu am putut trimite. Încearcă din nou.')
        return
      }
      const data = await res.json()
      setTickets((prev) => [data.ticket, ...prev])
      setSubject('')
      setMessage('')
      setView('list')
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSending(false)
    }
  }

  function close() {
    onClose()
    setView('list')
    setError('')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/20 sm:bg-transparent" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:w-96 sm:mr-5 sm:mb-5 p-5 max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="font-semibold">Suport Elmont</h2>
          <button onClick={close} aria-label="Închide">
            <X size={18} />
          </button>
        </div>

        {view === 'list' ? (
          <>
            <div className="flex-1 overflow-y-auto -mx-1 px-1">
              {loadingTickets ? (
                <p className="text-sm text-gray-400 py-4">Se încarcă...</p>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                  Nicio conversație încă. Ai o problemă sau o întrebare? Scrie-ne — ajunge direct la echipa Elmont.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {tickets.map((t) => (
                    <div key={t.id} className="rounded-xl border border-[var(--border-soft)] p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{t.subject}</p>
                        <span className="text-xs flex items-center gap-1" style={{ color: t.status === 'RESOLVED' ? '#16a34a' : '#eab308' }}>
                          {t.status === 'RESOLVED' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {STATUS_LABEL[t.status]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 whitespace-pre-wrap mb-2">{t.message}</p>
                      {t.reply && (
                        <div className="rounded-lg p-2 mt-1" style={{ background: 'var(--accent-soft)' }}>
                          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--accent)' }}>
                            Răspuns Elmont
                          </p>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap">{t.reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setView('new')} className="btn-primary w-full mt-3 shrink-0">
              + Tichet nou
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2.5">
            <p className="text-sm text-gray-500 mb-1">
              Ai o problemă sau o întrebare? Scrie-ne aici, ajunge direct la echipa Elmont.
            </p>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subiect (ex: Nu primesc mesaje pe WhatsApp)"
              className="input-field"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descrie problema în detaliu..."
              className="input-field min-h-[100px]"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setView('list')} className="btn-secondary flex-1">
                Înapoi
              </button>
              <button onClick={submit} disabled={sending} className="btn-primary flex-1">
                {sending ? 'Se trimite...' : 'Trimite'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// wrapper simplu cu buton propriu — păstrat pentru compatibilitate, dar nu mai e
// folosit ca buton flotant (mutat în bara de cont, vezi SidebarUserBlock)
export function SupportChatButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Suport" className="btn-secondary flex items-center gap-2">
        <MessageCircle size={16} /> Suport
      </button>
      <SupportChatPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
