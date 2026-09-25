'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardCopy, Download, ExternalLink, Loader2, Save, X } from 'lucide-react'
import type { ConnectionCaseDto, ConnectionFields } from '@/lib/connection-fields'
import { DEER_ACTIONS, DEER_CONTACT_EMAIL, DEER_STATUS_META, defaultDeerSubmission, extractDeerDossierNumber, isValidDeerDossierNumber, type DeerSubmission } from '@/lib/deer-submission'
import { SecurePdfViewerButton } from '@/components/secure-pdf-viewer-button'

const DEER_PORTAL_URL = 'https://avize.distributie-energie.ro/solicitare'

function localDateToday() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function withLegacyActionHistory(current: DeerSubmission, submittedAt: string | null) {
  if (current.actionHistory.length || !submittedAt) return current
  return { ...current, actionHistory: [{ action: current.action, submittedAt }] }
}

export function ConnectionDeerPanel({ item, fields, canEdit, onClose, onSaved }: {
  item: ConnectionCaseDto
  fields: ConnectionFields
  canEdit: boolean
  onClose: () => void
  onSaved: (deerSubmission: DeerSubmission, deerSubmittedAt: string | null) => void
}) {
  const atrDossierNumber = useMemo(() => extractDeerDossierNumber(fields.ATR), [fields.ATR])
  const [draft, setDraft] = useState<DeerSubmission>(() => {
    const current = withLegacyActionHistory(item.deerSubmission || defaultDeerSubmission(), item.deerSubmittedAt)
    return { ...current, dossierNumber: atrDossierNumber || current.dossierNumber, email: DEER_CONTACT_EMAIL }
  })
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const current = withLegacyActionHistory(item.deerSubmission || defaultDeerSubmission(), item.deerSubmittedAt)
    setDraft({ ...current, dossierNumber: atrDossierNumber || current.dossierNumber, email: DEER_CONTACT_EMAIL })
    setNotice('')
  }, [item.id, item.deerSubmission, item.deerSubmittedAt, atrDossierNumber])

  const applicant = fields.Beneficiar.trim()
  const locality = (fields.Sat || fields.Oras).trim()
  const street = [fields.Strada, fields.Nr && `nr. ${fields.Nr}`].filter(Boolean).join(', ')
  const dossierNumberValid = isValidDeerDossierNumber(draft.dossierNumber)
  const missing = useMemo(() => [
    !dossierNumberValid && 'numărul ATR / solicitării (exact 13 cifre)',
    !applicant && 'numele solicitantului',
    !locality && 'localitatea',
    !street && 'strada / numărul',
  ].filter(Boolean) as string[], [dossierNumberValid, applicant, locality, street])

  function summary(next = draft) {
    const actionLabel = DEER_ACTIONS.find(([value]) => value === next.action)?.[1] || next.action
    return [
      'DEPUNERE DEER',
      `Dosar: ${next.dossierNumber || '—'}`,
      `Solicitant: ${applicant || '—'}`,
      `Localitate: ${locality || '—'}`,
      `Stradă: ${street || '—'}`,
      `E-mail: ${next.email || '—'}`,
      `Acțiune pentru portal: ${actionLabel}`,
      `Acțiuni efectuate: ${next.actionHistory.length ? next.actionHistory.map((entry) => `${DEER_ACTIONS.find(([value]) => value === entry.action)?.[1] || entry.action} (${entry.submittedAt})`).join(', ') : '—'}`,
      `NIB intern: ${item.nib}`,
      next.registrationNumber && `Nr. înregistrare DEER: ${next.registrationNumber}`,
      next.notes && `Observații: ${next.notes}`,
    ].filter(Boolean).join('\n')
  }

  async function copyData(next = draft) {
    await navigator.clipboard.writeText(summary(next))
    setNotice('Datele au fost copiate. Le poți lipi și verifica în portalul DEER.')
  }

  async function save(next = draft) {
    if (!canEdit) return false
    const latestSubmittedAt = next.actionHistory.reduce((latest, entry) => entry.submittedAt > latest ? entry.submittedAt : latest, '')
    const automaticStatus: DeerSubmission['status'] = next.status === 'COMPLETED'
      ? 'COMPLETED'
      : next.registrationNumber.trim() ? 'REGISTERED'
        : latestSubmittedAt ? 'SUBMITTED'
          : next.lastPreparedAt ? 'READY' : 'DRAFT'
    const trackedNext = { ...next, status: automaticStatus }
    setBusy('save')
    const response = await fetch(`/api/bransamente/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deerSubmission: trackedNext, deerSubmittedAt: latestSubmittedAt || null }),
    })
    const body = await response.json().catch(() => ({}))
    setBusy('')
    if (!response.ok) {
      alert(body.error || 'Depunerea DEER nu a putut fi salvată.')
      return false
    }
    setDraft(trackedNext)
    onSaved(trackedNext, latestSubmittedAt || null)
    setNotice('Acțiunile și datele depunerilor DEER au fost salvate în registru.')
    return true
  }

  async function prepareAndOpen() {
    if (missing.length) return alert(`Completează înainte: ${missing.join(', ')}.`)
    const payload = {
      version: 1,
      dossierNumber: draft.dossierNumber,
      applicant,
      locality,
      street,
      action: draft.action,
      actionLabel: DEER_ACTIONS.find(([value]) => value === draft.action)?.[1] || draft.action,
      email: DEER_CONTACT_EMAIL,
    }
    const portalUrl = `${DEER_PORTAL_URL}#elmont=${encodeURIComponent(JSON.stringify(payload))}`
    const portalWindow = window.open('about:blank', '_blank')
    if (!portalWindow) return alert('Browserul a blocat fereastra nouă. Permite ferestre pop-up pentru Pontifix și încearcă din nou.')
    portalWindow.opener = null

    const next: DeerSubmission = { ...draft, status: draft.status === 'DRAFT' ? 'READY' : draft.status, lastPreparedAt: new Date().toISOString() }
    if (canEdit && !(await save(next))) {
      portalWindow.close()
      return
    }

    portalWindow.location.href = portalUrl
    setNotice('Portalul DEER a fost deschis. Extensia Elmont va completa automat câmpurile; tu completezi CAPTCHA.')
  }

  function toggleTrackedAction(action: DeerSubmission['action']) {
    if (!canEdit) return
    setDraft((current) => {
      const exists = current.actionHistory.some((entry) => entry.action === action)
      const actionHistory = exists
        ? current.actionHistory.filter((entry) => entry.action !== action)
        : [...current.actionHistory, { action, submittedAt: localDateToday() }]
      return {
        ...current,
        action: exists && current.action === action && actionHistory.length ? actionHistory[actionHistory.length - 1].action : exists ? current.action : action,
        actionHistory,
      }
    })
  }

  function updateTrackedActionDate(action: DeerSubmission['action'], submittedAt: string) {
    if (!canEdit || !submittedAt) return
    setDraft((current) => ({
      ...current,
      actionHistory: current.actionHistory.map((entry) => entry.action === action ? { ...entry, submittedAt } : entry),
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
              <label className="text-xs font-bold text-slate-500">Număr dosar / ATR (13 cifre) *
                <input disabled={!canEdit} inputMode="numeric" maxLength={13} value={draft.dossierNumber} onChange={(event) => setDraft({ ...draft, dossierNumber: event.target.value.replace(/\D/g, '').slice(0, 13) })} placeholder="0000000000000" className={`input-field mt-1.5 w-full bg-white disabled:bg-slate-50 ${draft.dossierNumber && !dossierNumberValid ? '!border-red-400' : ''}`}/>
                {atrDossierNumber && draft.dossierNumber === atrDossierNumber
                  ? <span className="mt-1.5 block text-[11px] font-bold text-emerald-700">Preluat automat din ATR-ul branșamentului.</span>
                  : draft.dossierNumber && !dossierNumberValid
                    ? <span className="mt-1.5 block text-[11px] font-bold text-red-600">Numărul trebuie să conțină exact 13 cifre.</span>
                    : null}
              </label>
              <label className="text-xs font-bold text-slate-500">Adresă e-mail
                <input readOnly type="email" value={DEER_CONTACT_EMAIL} className="input-field mt-1.5 w-full bg-slate-50 text-slate-600"/>
                <span className="mt-1.5 block text-[11px] font-bold text-slate-400">Adresă fixă pentru toate depunerile Elmont.</span>
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
            <h3 className="font-black text-[#082b4d]">Urmărire depunere</h3>
            <div className="mt-4">
              <div className="text-xs font-bold text-slate-500">Acțiuni efectuate / depuse</div>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">Poți bifa mai multe acțiuni. Fiecare are data ei; ultima acțiune bifată este folosită la completarea portalului.</p>
              <div className="mt-3 grid gap-2">{DEER_ACTIONS.map(([action, label]) => {
                const entry = draft.actionHistory.find((item) => item.action === action)
                return <div key={action} className={`rounded-xl border p-2.5 ${entry ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
                  <label className="flex cursor-pointer items-start gap-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" disabled={!canEdit} checked={Boolean(entry)} onChange={() => toggleTrackedAction(action)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"/>
                    <span className="flex-1">{label}{entry && draft.action === action ? <small className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">portal</small> : null}</span>
                  </label>
                  {entry ? <input aria-label={`Data depunerii pentru ${label}`} disabled={!canEdit} required type="date" value={entry.submittedAt} onChange={(event) => updateTrackedActionDate(action, event.target.value)} className="input-field mt-2 w-full bg-white disabled:bg-slate-50"/> : null}
                </div>
              })}</div>
            </div>
            <label className="mt-3 block text-xs font-bold text-slate-500">Număr înregistrare DEER
              <input disabled={!canEdit} value={draft.registrationNumber} onChange={(event) => setDraft({ ...draft, registrationNumber: event.target.value })} className="input-field mt-1.5 w-full bg-white disabled:bg-slate-50"/>
            </label>
            <label className="mt-3 block text-xs font-bold text-slate-500">Observații
              <textarea disabled={!canEdit} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="input-field mt-1.5 min-h-28 w-full resize-y bg-white disabled:bg-slate-50"/>
            </label>
          </section>
        </div>

        <aside className="space-y-4">

          <section className="rounded-2xl border border-blue-100 bg-[#f3f9fd] p-4">
            <h3 className="font-black text-[#082b4d]">Finalizare pe portal</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Butonul deschide portalul DEER și completează automat numărul ATR, solicitantul, adresa, acțiunea și e-mailul. Tu completezi CAPTCHA și verifici datele.</p>
            <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold leading-5 text-slate-500">La prima utilizare instalează extensia Elmont în Chrome: descarcă arhiva, extrage folderul, apoi deschide chrome://extensions, activează Modul pentru dezvoltatori și alege „Încarcă extensia neîmpachetată”.</p>
            <a href="/elmont-deer-autofill.zip" download className="btn-secondary mt-3 inline-flex w-full items-center justify-center gap-2"><Download size={16}/> Descarcă extensia Chrome</a>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => copyData()} className="btn-secondary inline-flex items-center justify-center gap-2"><ClipboardCopy size={16}/> Copiază datele</button>
              <button type="button" onClick={prepareAndOpen} disabled={!!busy} className="btn-primary inline-flex items-center justify-center gap-2">{busy ? <Loader2 size={16} className="animate-spin"/> : <ExternalLink size={16}/>} Deschide și completează DEER</button>
              {canEdit && <button type="button" onClick={() => save()} disabled={!!busy} className="btn-secondary inline-flex items-center justify-center gap-2">{busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvează în registru</button>}
            </div>
            {canEdit && item.atrPathname && <SecurePdfViewerButton url={`/api/bransamente/${item.id}/atr`} title={`ATR · ${fields.Beneficiar || item.nib}`} className="mt-3 flex w-full items-center justify-center gap-2 text-xs font-black text-[#0d5d8b]">Deschide ATR-ul salvat</SecurePdfViewerButton>}
            {notice && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-700">{notice}</p>}
          </section>
        </aside>
      </div>
    </div>
  </div>
}
