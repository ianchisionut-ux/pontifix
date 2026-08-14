'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, Loader2, Search, ShieldCheck } from 'lucide-react'

type Result = { nib: string; label: string; progress: number; color: string; updatedAt: string }

export function PublicConnectionStatus() {
  const [nib, setNib] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function verify(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null)
    const response = await fetch('/api/public/connection-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nib }) })
    const body = await response.json().catch(() => ({})); setBusy(false)
    if (!response.ok) return setError(body.error || 'Verificarea nu a putut fi făcută.')
    setResult(body)
  }

  return <section id="verifica-bransament" className="relative -mt-8 z-30 px-5 pb-16 lg:px-10">
    <div className="mx-auto max-w-[1180px] rounded-[30px] border border-white bg-white p-6 shadow-2xl shadow-[#082b4d]/10 lg:flex lg:items-center lg:gap-10 lg:p-8">
      <div className="mb-6 lg:mb-0 lg:w-[38%]"><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-[#197fb5]"><ShieldCheck size={16}/> Urmărire transparentă</span><h2 className="mt-2 text-2xl font-black tracking-tight text-[#082b4d]">Verifică stadiul branșamentului</h2><p className="mt-2 text-sm leading-6 text-slate-500">Introdu NIB-ul primit după aprobarea ofertei și vezi imediat stadiul lucrării.</p></div>
      <div className="min-w-0 flex-1"><form onSubmit={verify} className="flex flex-col gap-3 sm:flex-row"><label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4"><Search size={18} className="text-[#197fb5]"/><input value={nib} onChange={(event) => setNib(event.target.value.toUpperCase())} placeholder="NIB-2026-0001" className="h-14 min-w-0 flex-1 bg-transparent font-bold uppercase tracking-wide outline-none"/></label><button disabled={busy} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#0d5d8b] px-6 font-bold text-white hover:bg-[#082b4d] disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={18}/> : <ArrowRight size={18}/>} Verifică</button></form>
        {error && <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}
        {result && <div className="mt-5 rounded-2xl border border-slate-100 bg-[#f7fbfd] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black text-[#197fb5]">{result.nib}</p><p className="mt-1 flex items-center gap-2 font-bold text-[#082b4d]">{result.progress === 100 && <CheckCircle2 size={18} className="text-emerald-500"/>}{result.label}</p></div><strong style={{ color: result.color }}>{result.progress}%</strong></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full transition-all" style={{ width: `${result.progress}%`, backgroundColor: result.color }}/></div><p className="mt-2 text-xs text-slate-400">Actualizat {new Date(result.updatedAt).toLocaleString('ro-RO')}</p></div>}
      </div>
    </div>
  </section>
}
