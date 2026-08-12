'use client'

import { useEffect, useState } from 'react'
import { Clock3, LogIn, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function ClockCard({ activeSince }: { activeSince: string | null }) {
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(new Date())
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  async function toggle() {
    setBusy(true)
    const response = await fetch('/api/attendance/clock', { method: 'POST' })
    setBusy(false)
    if (!response.ok) return alert('Pontajul nu a putut fi salvat.')
    router.refresh()
  }

  const elapsed = activeSince ? Math.max(0, now.getTime() - new Date(activeSince).getTime()) : 0
  const hours = Math.floor(elapsed / 3600000)
  const minutes = Math.floor((elapsed % 3600000) / 60000)
  const seconds = Math.floor((elapsed % 60000) / 1000)

  return (
    <section className="rounded-3xl bg-slate-950 text-white p-6 lg:p-8 shadow-xl shadow-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-slate-400 text-sm mb-2">{now.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p className="text-4xl lg:text-5xl font-semibold tracking-tight tabular-nums">{now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <Clock3 className="text-violet-400" size={28} />
      </div>

      <div className="mt-8 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <p className="text-sm text-slate-400">{activeSince ? 'Sesiune în desfășurare' : 'Nu ești pontat'}</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">
            {activeSince ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : '00:00:00'}
          </p>
        </div>
        <button onClick={toggle} disabled={busy} className={`rounded-2xl px-6 py-3 font-semibold inline-flex items-center justify-center gap-2 transition ${activeSince ? 'bg-rose-500 hover:bg-rose-400' : 'bg-violet-500 hover:bg-violet-400'} disabled:opacity-60`}>
          {activeSince ? <LogOut size={18} /> : <LogIn size={18} />}
          {busy ? 'Se salvează...' : activeSince ? 'Încheie programul' : 'Începe programul'}
        </button>
      </div>
    </section>
  )
}
