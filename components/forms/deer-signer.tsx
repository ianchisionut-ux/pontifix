'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, Download, Eraser, ExternalLink, FileText, PenLine } from 'lucide-react'
import type { SigningDocument } from '@/lib/deer-signing-bundle'
import { SIGNING_DECLARATION, SIGNING_LEGAL_NOTE } from '@/lib/deer-signing-shared'

export function DeerSigner({ token, beneficiaryName, nib, documents, available, completed, expiresAt }: {
  token: string; beneficiaryName: string; nib: string; documents: SigningDocument[]; available: boolean; completed: boolean; expiresAt: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [read, setRead] = useState<string[]>([])
  const [opened, setOpened] = useState<string[]>([])
  const [agreement, setAgreement] = useState(false)
  const [identity, setIdentity] = useState(false)
  const [name, setName] = useState('')
  const [ink, setInk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(completed)
  const [error, setError] = useState('')
  const documentUrl = `/api/public/deer-signing/${encodeURIComponent(token)}/document`

  function context() {
    const element = canvas.current
    if (!element) return null
    if (element.width !== 900) { element.width = 900; element.height = 300 }
    const value = element.getContext('2d')
    if (value) { value.strokeStyle = '#1648b0'; value.fillStyle = '#1648b0'; value.lineWidth = 4; value.lineCap = 'round'; value.lineJoin = 'round' }
    return value
  }
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - box.left) * 900 / box.width, y: (event.clientY - box.top) * 300 / box.height }
  }
  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drawing.current = true
    const current = point(event); last.current = current
    const ctx = context(); if (ctx) { ctx.beginPath(); ctx.arc(current.x, current.y, 2, 0, Math.PI * 2); ctx.fill() }
    setInk(true)
  }
  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return
    event.preventDefault()
    const current = point(event); const ctx = context()
    if (ctx) { ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(current.x, current.y); ctx.stroke() }
    last.current = current
  }
  function clear() { context()?.clearRect(0, 0, 900, 300); setInk(false) }
  async function submit() {
    if (!canvas.current) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/public/deer-signing/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptedName: name, readDocumentIds: read, agreement, identityConfirmed: identity, image: canvas.current.toDataURL('image/png') }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Semnarea nu a reușit.')
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Semnarea nu a reușit.') }
    finally { setBusy(false) }
  }
  const signingDocuments = documents.filter((item) => item.signatures.length)
  return <main className="min-h-dvh bg-[#edf5f9] px-3 py-5 text-[#082b4d] sm:px-6 sm:py-8">
    <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <header className="bg-[#0d5d8b] px-5 py-6 text-white sm:px-8"><p className="text-xs font-black uppercase tracking-[.16em] text-sky-200">ELMONT S.A. · documente DEER</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{done ? 'Documente semnate' : 'Analizează și semnează documentele'}</h1><p className="mt-2 text-sm text-sky-100">Dosar {nib} · {beneficiaryName}</p></header>
      <div className="space-y-6 p-4 sm:p-8">
        {!available ? <div role="alert" className="rounded-2xl bg-amber-50 p-5 text-amber-900">Acest link a expirat sau a fost anulat. Cere un link nou de la Elmont.</div> : done ? <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="mb-2"/><b className="block text-xl">Semnarea a fost înregistrată.</b><p className="mt-2">Poți descărca copia documentelor semnate până la expirarea linkului.</p><a className="btn-primary mt-4 inline-flex items-center gap-2" href={`${documentUrl}?version=signed&download=1`}><Download size={17}/> Descarcă PDF-ul semnat</a></div> : <>
          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed"><b>Procedura în 3 pași</b><ol className="mt-2 list-inside list-decimal space-y-1"><li>Deschide și analizează PDF-ul cu toate documentele de mai jos.</li><li>Bifează fiecare document parcurs și confirmă acordul tău.</li><li>Scrie numele și desenează semnătura albastră; apoi apasă „Semnează documentele”.</li></ol><p className="mt-3">Link privat valabil până la {new Date(expiresAt).toLocaleString('ro-RO')}. Nu îl transmite altor persoane.</p></section>
          <section><h2 className="text-lg font-extrabold">1. Documentele tale</h2><p className="mt-1 text-sm text-slate-600">PDF-ul de mai jos este versiunea fixată pentru această semnare. Semnătura va fi aplicată doar în pozițiile pregătite de Elmont.</p><a href={documentUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-3 inline-flex items-center gap-2"><ExternalLink size={16}/> Deschide PDF-ul complet</a><div className="mt-4 hidden h-[620px] overflow-hidden rounded-xl border border-slate-200 md:block"><iframe title="Documentele DEER de analizat" src={`${documentUrl}#toolbar=1`} className="h-full w-full"/></div>
            <div className="mt-4 space-y-2">{documents.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3"><FileText size={19} className="shrink-0 text-[#0d5d8b]"/><div className="min-w-[150px] flex-1"><b className="block text-sm">{item.title}</b><span className="text-xs text-slate-500">{item.pageCount} {item.pageCount === 1 ? 'pagină' : 'pagini'} · {item.signatures.length ? 'necesită semnătură' : 'doar pentru analiză'}</span></div><a href={`${documentUrl}#page=${item.firstPage}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpened((value) => value.includes(item.id) ? value : [...value, item.id])} className="btn-secondary !px-3 !py-2 text-xs">Deschide</a><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={read.includes(item.id)} disabled={!opened.includes(item.id)} onChange={(event) => setRead((value) => event.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id))}/> Am parcurs</label></div>)}</div><p className="mt-2 text-xs text-slate-500">Deschide fiecare document, apoi confirmă că l-ai parcurs. Bifarea reprezintă declarația ta.</p></section>
          <section className="border-t border-slate-200 pt-6"><h2 className="text-lg font-extrabold">2. Acordul tău</h2><label className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed"><input type="checkbox" className="mt-1" checked={agreement} onChange={(event) => setAgreement(event.target.checked)}/><span>{SIGNING_DECLARATION}</span></label><label className="mt-3 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm"><input type="checkbox" className="mt-1" checked={identity} onChange={(event) => setIdentity(event.target.checked)}/><span>Confirm că eu sunt {beneficiaryName} și semnez personal aceste documente, fără ca altcineva să deseneze în locul meu.</span></label><p className="mt-3 text-xs leading-relaxed text-slate-600">{SIGNING_LEGAL_NOTE} <a href="/politica-de-confidentialitate" target="_blank" rel="noopener noreferrer" className="underline">Politica de confidențialitate</a>.</p></section>
          <section className="border-t border-slate-200 pt-6"><h2 className="text-lg font-extrabold">3. Semnătura ta</h2><p className="mt-1 text-sm text-slate-600">Se va aplica pe {signingDocuments.length} {signingDocuments.length === 1 ? 'document' : 'documente'}, în {signingDocuments.reduce((sum, item) => sum + item.signatures.length, 0)} {signingDocuments.reduce((sum, item) => sum + item.signatures.length, 0) === 1 ? 'loc' : 'locuri'}.</p><label className="mt-4 block text-sm font-bold">Numele și prenumele<input className="input-field mt-2 !w-full" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={beneficiaryName} maxLength={120}/></label><div className="mt-4 overflow-hidden rounded-xl border-2 border-dashed border-blue-300 bg-white"><canvas ref={canvas} width={900} height={300} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drawing.current = false; last.current = null }} onPointerCancel={() => { drawing.current = false; last.current = null }} className="block h-[190px] w-full touch-none sm:h-[260px] landscape:max-h-[36dvh]" aria-label="Desenează semnătura cu degetul"/></div><button type="button" className="btn-secondary mt-3 inline-flex items-center gap-2" onClick={clear}><Eraser size={16}/> Șterge desenul</button></section>
          {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
          <button type="button" className="btn-primary flex w-full items-center justify-center gap-2 !py-4 text-base" disabled={busy || read.length !== documents.length || !agreement || !identity || name.trim().length < 5 || !ink} onClick={submit}><PenLine size={18}/>{busy ? 'Se înregistrează…' : 'Semnează documentele'}</button>
        </>}
      </div>
    </div>
  </main>
}
