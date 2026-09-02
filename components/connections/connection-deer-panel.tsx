'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardCopy, ExternalLink, FileCheck2, FileText, Loader2, Save, X } from 'lucide-react'
import type { ConnectionCaseDto, ConnectionFields } from '@/lib/connection-fields'
import { DEER_ACTIONS, DEER_DOCUMENTS, DEER_STATUSES, DEER_STATUS_META, defaultDeerSubmission, type DeerSubmission } from '@/lib/deer-submission'

const DEER_PORTAL_URL = 'https://avize.distributie-energie.ro/solicitare'

export function ConnectionDeerPanel({ item, fields, canEdit, onClose, onSaved }: {
  item: ConnectionCaseDto
  fields: ConnectionFields
  canEdit: boolean
  onClose: () => void
  onSaved: (deerSubmission: DeerSubmission, deerSubmittedAt: string | null) => void
}) {
  const [draft, setDraft] = useState<DeerSubmission>(item.deerSubmission || defaultDeerSubmission())
  const [submittedAt, setSubmittedAt] = useState(item.deerSubmittedAt || '')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setDraft(item.deerSubmission || defaultDeerSubmission())
    setSubmittedAt(item.deerSubmittedAt || '')
    setNotice('')
  }, [item.id, item.deerSubmission, item.deerSubmittedAt])

  const applicant = fields.Beneficiar.trim()
  const locality = (fields.Sat || fields.Oras).trim()
  const street = [fields.Strada, fields.Nr && `nr. ${fields.Nr}`].filter(Boolean).join(', ')
  const missing = useMemo(() => [
    !draft.dossierNumber.trim() && 'numărul dosarului DEER',
    !applicant && 'numele solicitantului',
    !locality && 'localitatea',
    !street && 'strada / numărul',
  ].filter(Boolean) as string[], [draft.dossierNumber, applicant, locality, street])

  function summary(next = draft) {
    const actionLabel = DEER_ACTIONS.find(([value]) => value === next.action)?.[1] || next.action
    return [
      'DEPUNERE DEER',
      `Dosar: ${next.dossierNumber || '—'}`,
      `Solicitant: ${applicant || '—'}`,
      `Localitate: ${locality || '—'}`,
      `Stradă: ${street || '—'}`,
      `E-mail: ${next.email || '—'}`,
      `Acțiune: ${actionLabel}`,
      `Documente: ${next.documents.length ? next.documents.join(', ') : '—'}`,
      `NIB intern: ${item.nib}`,
      next.registrationNumber && `Nr. înregistrare DEER: ${next.registrationNumber}`,
      next.notes && `Observații: ${next.notes}`,
    ].filter(Boolean).join('\n')
  }

  async function copyData(next = draft) {
    await navigator.clipboard.writeText(summary(next))
    setNotice('Datele au fost copiate. Le poți lipi și verifica în portalul DEER.')
  }

  async function save(next = draft, nextSubmittedAt = submittedAt) {
    if (!canEdit) return false
    setBusy('save')
    const response = await fetch(`/api/bransamente/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deerSubmission: next, deerSubmittedAt: nextSubmittedAt || null }),
    })
    const body = await response.json().catch(() => ({}))
    setBusy('')
    if (!response.ok) {
      alert(body.error || 'Depunerea DEER nu a putut fi salvată.')
      return false
    }
    setDraft(next)
    setSubmittedAt(nextSubmittedAt)
    onSaved(next, nextSubmittedAt || null)
    setNotice('Datele depunerii DEER au fost salvate.')
    return true
  }

  async function prepareAndOpen() {
    if (missing.length) return alert(`Completează înainte: ${missing.join(', ')}.`)
    const next: DeerSubmission = { ...draft, status: draft.status === 'DRAFT' ? 'READY' : draft.status, lastPreparedAt: new Date().toISOString() }
    if (canEdit && !(await save(next))) return
    await copyData(next)
    window.open(DEER_PORTAL_URL, '_blank', 'noopener,noreferrer')
  }

  function toggleDocument(document: string) {
    if (!canEdit) return
    setDraft((current) => ({
      ...current,
      documents: current.documents.includes(document)
        ? current.documents.filter((entry) => entry !== document)
        : [...current.documents, document],
    }))
  }

  const statusMeta = DEER_STATUS_META[draft.status]

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-3 lg:p-6" role="dialog" aria-modal="true">
    <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur lg:px-7">
        <div>
          <span className="text-xs font-black uppercase tracking-[.15em] text-[#197fb5]">Legătură asistată cu portalul DEER</span>
          <h2 className="mt-1 text-2xl font-black text-[#082b4d]">Depunere documentație · {item.nib}</h2>
          <p className="mt-1 text-sm text-slate-500">Pregătește datele aici, apoi finalizează depunerea și CAPTCHA pe portalul oficial.</p>
        </div>
        <button onClick={onClose} className="round-action shrink-0" aria-label="Închide"><X size={18}/></button>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1.25fr_.75fr] lg:p-7">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-black text-[#082b4d]">Datele solicitării</h3>
              <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: statusMeta.color }}>{statusMeta.label}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs font-bold text-slate-500">Număr dosar DEER *
                <input disabled={!canEdit} value={draft.dossierNumber} onChange={(event) => setDraft({ ...draft, dossierNumber: event.target.value })} placeholder="Numărul comunicat de DEER" className="input-field mt-1.5 w-full bg-white disabled:bg-slate-50"/>
              </label>
              <label className="text-xs font-bold text-slate-500">Adresă e-mail
                <input disabled={!canEdit} type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="E-mail pentru confirmare" className="input-field mt-1.5 w-full bg-white disabled:bg-slate-50"/>
              </label>
              <label className="text-xs font-bold text-slate-500 md:col-span-2">Acțiune
                <select disabled={!canEdit} value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value as DeerSubmission['action'] })} className="input-field mt-1.5 w-full bg-white disabled:bg-slate-50">
                  {DEER_ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <dl className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-2">
              <div><dt className="text-xs font-bold text-slate-400">Solicitant</dt><dd className="mt-1 font-bold text-slate-700">{applicant || 'Necompletat'}</dd></div>
              <div><dt className="text-xs font-bold text-slate-400">Localitate</dt><dd className="mt-1 font-bold text-slate-700">{locality || 'Necompletată'}</dd></div>
              <div className="md:col-span-2"><dt className="text-xs font-bold text-slate-400">Stradă / adresă</dt><dd className="mt-1 font-bold text-slate-700">{street || 'Necompletată'}</dd></div>
            </dl>
            {missing.length > 0 && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Lipsesc: {missing.join(', ')}.</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="font-black text-[#082b4d]">Documente pregătite</h3>
            <p className="mt-1 text-xs text-slate-500">Bifele formează lista de control a depunerii. Fișierele se aleg în portalul DEER.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">{DEER_DOCUMENTS.map((document) => {
              const checked = draft.documents.includes(document)
              return <button key={document} type="button" disabled={!canEdit} onClick={() => toggleDocument(document)} className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${checked ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:cursor-default`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>{checked && <CheckCircle2 size={14}/>}</span>{document}
              </button>
            })}</div>
            {item.atrPathname && <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800"><FileCheck2 size={16}/> ATR-ul este deja salvat în fișa branșamentului.</div>}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="font-black text-[#082b4d]">Urmărire depunere</h3>
            <label className="mt-4 block text-xs font-bold text-slate-500">Stare
              <select disabled={!canEdit} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as DeerSubmission['status'] })} className="input-field mt-1.5 w-full bg-white disabled:bg-slate-50">
                {DEER_STATUSES.map((status) => <option key={status} value={status}>{DEER_STATUS_META[status].label}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-xs font-bold text-slate-500">Data depunerii
              <input disabled={!canEdit} type="date" value={submittedAt} onChange={(event) => setSubmittedAt(event.target.value)} className="input-field mt-1.5 w-full bg-white disabled:bg-slate-50"/>
            </label>
            <label className="mt-3 block text-xs font-bold text-slate-500">Număr înregistrare DEER
              <input disabled={!canEdit} value={draft.registrationNumber} onChange={(event) => setDraft({ ...draft, registrationNumber: event.target.value })} className="input-field mt-1.5 w-full bg-white disabled:bg-slate-50"/>
            </label>
            <label className="mt-3 block text-xs font-bold text-slate-500">Observații
              <textarea disabled={!canEdit} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="input-field mt-1.5 min-h-28 w-full resize-y bg-white disabled:bg-slate-50"/>
            </label>
          </section>

          <section className="rounded-2xl border border-blue-100 bg-[#f3f9fd] p-4">
            <h3 className="font-black text-[#082b4d]">Finalizare pe portal</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Portalul DEER nu permite afișarea în Elmont și cere CAPTCHA. Butonul copiază sumarul, salvează pregătirea și deschide pagina oficială.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => copyData()} className="btn-secondary inline-flex items-center justify-center gap-2"><ClipboardCopy size={16}/> Copiază datele</button>
              <button type="button" onClick={prepareAndOpen} disabled={!!busy} className="btn-primary inline-flex items-center justify-center gap-2">{busy ? <Loader2 size={16} className="animate-spin"/> : <ExternalLink size={16}/>} Deschide portalul DEER</button>
              {canEdit && <button type="button" onClick={() => save()} disabled={!!busy} className="btn-secondary inline-flex items-center justify-center gap-2">{busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvează în registru</button>}
            </div>
            {canEdit && item.atrPathname && <a href={`/api/bransamente/${item.id}/atr`} target="_blank" className="mt-3 flex items-center justify-center gap-2 text-xs font-black text-[#0d5d8b]"><FileText size={14}/> Deschide ATR-ul salvat</a>}
            {notice && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-700">{notice}</p>}
          </section>
        </aside>
      </div>
    </div>
  </div>
}
