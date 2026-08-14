'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'

export function CustomerChatWidget() {
  const { tr } = useLanguage()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(formData: FormData) {
    setBusy(true); setError('')
    const response = await fetch('/api/public/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(formData)) })
    const data = await response.json().catch(() => ({})); setBusy(false)
    if (!response.ok) return setError(data.error || 'Mesajul nu a putut fi trimis.')
    setDone(true)
  }

  return <div className="fixed bottom-5 right-5 z-[70] screen-only">
    {open && <div className="mb-3 w-[min(390px,calc(100vw-2.5rem))] overflow-hidden rounded-3xl border border-[#d9eef8] bg-white shadow-2xl shadow-[#082b4d]/20">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#0d5d8b] to-[#2f91c8] px-5 py-4 text-white"><div><p className="font-extrabold">{tr('Întrebări rapide')}</p><p className="text-xs text-blue-100">{tr('Scrie-ne și revenim cu un răspuns.')}</p></div><button onClick={()=>setOpen(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Închide"><X size={18}/></button></div>
      {done ? <div className="p-7 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={38}/><h3 className="mt-3 font-bold text-[#082b4d]">{tr('Mesaj trimis')}</h3><p className="mt-2 text-sm text-slate-500">{tr('Echipa Elmont va reveni folosind datele de contact oferite.')}</p><button onClick={()=>{setDone(false);setOpen(false)}} className="btn-secondary mt-5">OK</button></div> : <form action={submit} className="space-y-3 p-5">
        <input name="name" className="input-field w-full" placeholder={tr('Nume și prenume')} required maxLength={120}/>
        <div className="grid grid-cols-2 gap-3"><input name="phone" className="input-field w-full" placeholder={tr('Telefon')}/><input name="email" type="email" className="input-field w-full" placeholder="E-mail"/></div>
        <textarea name="message" className="input-field min-h-28 w-full resize-y" placeholder={tr('Cu ce te putem ajuta?')} required maxLength={1500}/>
        {error&&<p className="text-sm text-rose-600">{error}</p>}
        <button className="btn-primary flex w-full items-center justify-center gap-2" disabled={busy}>{busy?<Loader2 size={17} className="animate-spin"/>:<Send size={17}/>} {busy?tr('Se trimite...'):tr('Trimite mesajul')}</button>
      </form>}
    </div>}
    <div className="flex items-center justify-end gap-3">{!open && <button type="button" onClick={()=>setOpen(true)} className="relative rounded-2xl border border-[#d9eef8] bg-white px-4 py-2.5 text-sm font-extrabold text-[#0d5d8b] shadow-lg shadow-[#082b4d]/10 transition hover:-translate-y-0.5 hover:border-[#8bc8e5]">{tr('Ai o întrebare?')}<span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-[#d9eef8] bg-white"/></button>}<button onClick={()=>setOpen(value=>!value)} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0d5d8b] to-[#2f91c8] text-white shadow-xl shadow-[#0d5d8b]/30 transition hover:scale-105" aria-label={tr('Întrebări rapide')}>{open?<X size={25}/>:<MessageCircle size={28}/>}</button></div>
  </div>
}
