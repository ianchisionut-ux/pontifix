'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { playInternalChatSound, registerInternalChatWorker, showInternalChatNotification } from '@/lib/internal-chat-browser'

type Incoming = { id: string; senderName: string; text: string }

export function InternalChatNotifier() {
  const since = useRef(new Date().toISOString())
  const polling = useRef(false)
  const [incoming, setIncoming] = useState<Incoming | null>(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') registerInternalChatWorker().catch(() => undefined)
    let cancelled = false
    async function poll() {
      if (polling.current) return
      polling.current = true
      try {
        const response = await fetch(`/api/internal-chat/notifications?since=${encodeURIComponent(since.current)}`, { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json() as { items: Incoming[]; serverTime: string; unreadCount: number }
        if (cancelled) return
        since.current = data.serverTime
        window.dispatchEvent(new CustomEvent('internal-chat-unread', { detail: data.unreadCount }))
        if (!data.items.length) return
        setIncoming(data.items[data.items.length - 1])
        setCount(data.items.length)
        playInternalChatSound()
        if (document.hidden) {
          for (const item of data.items) {
            await showInternalChatNotification(`Mesaj nou de la ${item.senderName}`, item.text.length > 140 ? `${item.text.slice(0, 137)}…` : item.text, `internal-chat-${item.id}`)
          }
        }
      } catch { /* următoarea verificare reîncearcă */ }
      finally { polling.current = false }
    }
    const firstPoll = setTimeout(poll, 1200)
    const timer = setInterval(poll, 4000)
    return () => { cancelled = true; clearTimeout(firstPoll); clearInterval(timer) }
  }, [])

  if (!incoming) return null
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onClick={() => setIncoming(null)}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="new-chat-title" className="w-full max-w-lg rounded-3xl border border-blue-100 bg-white p-6 shadow-[0_28px_90px_rgba(8,43,77,.35)] sm:p-8" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#197fb5] text-white"><MessageCircle size={29}/></span><button type="button" aria-label="Închide notificarea" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" onClick={() => setIncoming(null)}><X size={21}/></button></div>
      <p className="mt-5 text-xs font-black uppercase tracking-[.14em] text-[#197fb5]">Mesaj nou {count > 1 ? `· ${count} mesaje` : ''}</p>
      <h2 id="new-chat-title" className="mt-1 text-2xl font-bold text-[#082b4d]">{incoming.senderName}</h2>
      <p className="mt-4 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-50 p-4 text-base leading-7 text-slate-700">{incoming.text}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setIncoming(null)}>Mai târziu</button><button type="button" className="btn-primary" onClick={() => { setIncoming(null); if (window.location.hostname !== 'chat.elmont.ro') window.location.assign('https://chat.elmont.ro/chat') }}>Deschide chatul</button></div>
    </section>
  </div>
}
