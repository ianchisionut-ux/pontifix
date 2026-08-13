'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { ArrowRight, CheckCircle2, FileText, Loader2, UploadCloud, X } from 'lucide-react'

type QuoteForm = {
  name: string
  email: string
  phone: string
  serviceType: string
  location: string
  message: string
  consent: boolean
}

const initialForm: QuoteForm = { name: '', email: '', phone: '', serviceType: 'Branșament electric', location: '', message: '', consent: false }

export function QuoteRequestForm() {
  const [form, setForm] = useState(initialForm)
  const [atrFile, setAtrFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  function update<K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function chooseFile(file?: File) {
    setError('')
    if (!file) return
    if (file.type !== 'application/pdf') return setError('ATR-ul trebuie încărcat în format PDF.')
    if (file.size > 10 * 1024 * 1024) return setError('Fișierul ATR poate avea maximum 10 MB.')
    setAtrFile(file)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      let atrPathname = ''
      if (atrFile) {
        const blob = await upload(`cereri-oferta/${crypto.randomUUID()}/${atrFile.name}`, atrFile, {
          access: 'private',
          handleUploadUrl: '/api/public/quote-upload',
        })
        atrPathname = blob.pathname
      }

      const response = await fetch('/api/public/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, atrPathname, atrName: atrFile?.name || '' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Cererea nu a putut fi trimisă.')
      setDone(true)
      setForm(initialForm)
      setAtrFile(null)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Cererea nu a putut fi trimisă.')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="flex min-h-[560px] flex-col items-center justify-center rounded-[32px] bg-white p-8 text-center shadow-2xl shadow-slate-950/10">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={40}/></span>
      <h3 className="mt-7 text-3xl font-bold tracking-tight text-[#082b4d]">Cererea a ajuns la noi.</h3>
      <p className="mt-3 max-w-md leading-7 text-slate-500">Analizăm datele proiectului și revenim pentru clarificări sau ofertare. Dacă ai încărcat ATR-ul, documentul a fost salvat în siguranță.</p>
      <button type="button" onClick={() => setDone(false)} className="mt-8 rounded-full bg-[#0d5d8b] px-6 py-3 text-sm font-bold text-white hover:bg-[#082b4d]">Trimite o altă cerere</button>
    </div>
  )

  return (
    <form onSubmit={submit} className="rounded-[32px] bg-white p-6 text-left shadow-2xl shadow-slate-950/10 sm:p-9">
      <div className="mb-7">
        <span className="text-xs font-extrabold uppercase tracking-[.18em] text-[#197fb5]">Cerere de ofertă</span>
        <h3 className="mt-2 text-3xl font-bold tracking-tight text-[#082b4d]">Spune-ne ce construim.</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">Câmpurile marcate sunt obligatorii. ATR-ul este opțional, dar ne ajută să ofertăm mai precis.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="quote-label">Nume și prenume *<input className="quote-input" value={form.name} onChange={(e) => update('name', e.target.value)} required maxLength={120}/></label>
        <label className="quote-label">Telefon *<input className="quote-input" type="tel" inputMode="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} required maxLength={30}/></label>
        <label className="quote-label">Email *<input className="quote-input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required maxLength={180}/></label>
        <label className="quote-label">Localitatea lucrării<input className="quote-input" value={form.location} onChange={(e) => update('location', e.target.value)} maxLength={180}/></label>
      </div>

      <label className="quote-label mt-4">Tipul proiectului *
        <select className="quote-input" value={form.serviceType} onChange={(e) => update('serviceType', e.target.value)} required>
          <option>Branșament electric</option>
          <option>Proiectare instalații electrice</option>
          <option>Execuție rețea electrică</option>
          <option>Post de transformare</option>
          <option>Instalație de paratrăsnet / împământare</option>
          <option>Alt tip de lucrare</option>
        </select>
      </label>

      <label className="quote-label mt-4">Detalii despre proiect<textarea className="quote-input min-h-28 resize-y py-3" value={form.message} onChange={(e) => update('message', e.target.value)} maxLength={2000} placeholder="Puterea solicitată, tipul imobilului, termenul dorit sau alte informații utile..."/></label>

      <div className="mt-5">
        <span className="quote-label">Aviz tehnic de racordare - ATR <span className="font-normal text-slate-400">(opțional)</span></span>
        <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => chooseFile(e.target.files?.[0])}/>
        {atrFile ? (
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[#8bc8e5] bg-[#edf7fc] p-4">
            <FileText className="text-[#197fb5]" size={22}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#082b4d]">{atrFile.name}</p><p className="text-xs text-slate-500">{(atrFile.size / 1024 / 1024).toFixed(2)} MB · PDF</p></div>
            <button type="button" onClick={() => setAtrFile(null)} className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-rose-500" aria-label="Elimină documentul"><X size={18}/></button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInput.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); chooseFile(e.dataTransfer.files?.[0]) }} className="mt-2 flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-[#8bc8e5] bg-[#f4fbfe] px-5 py-6 text-sm font-bold text-[#0f679b] transition hover:border-[#197fb5] hover:bg-[#edf7fc]">
            <UploadCloud size={21}/> Selectează sau trage aici documentul PDF
          </button>
        )}
      </div>

      <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-slate-500"><input type="checkbox" checked={form.consent} onChange={(e) => update('consent', e.target.checked)} required className="mt-1 accent-[#197fb5]"/><span>Sunt de acord ca Elmont S.A. să folosească datele transmise pentru analiza și ofertarea solicitării, conform <a href="/politica-de-confidentialitate" className="font-bold text-[#0f679b] hover:underline">politicii de confidențialitate</a>.</span></label>

      {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>}
      <button type="submit" disabled={loading} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0d5d8b] to-[#2f91c8] font-bold text-white shadow-lg shadow-[#197fb5]/20 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70">
        {loading ? <><Loader2 size={19} className="animate-spin"/> Se trimite...</> : <>Solicită oferta <ArrowRight size={19}/></>}
      </button>
    </form>
  )
}
