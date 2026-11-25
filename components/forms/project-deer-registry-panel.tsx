'use client'

import { useState } from 'react'
import { ClipboardList, ExternalLink, Loader2, Save, X } from 'lucide-react'
import { DEER_ACTIONS, DEER_CONTACT_EMAIL, DEER_STATUS_META, defaultDeerSubmission, type DeerSubmission } from '@/lib/deer-submission'
import type { ProjectDeerRegistryEntry } from '@/lib/project-deer-registry'
import type { ProjectFormOption } from './pdf-request-editor'

function localDateToday() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

export function ProjectDeerRegistryPanel({ project, entry, canEdit, onClose, onSaved }: {
  project: ProjectFormOption
  entry?: ProjectDeerRegistryEntry
  canEdit: boolean
  onClose: () => void
  onSaved: (entry: ProjectDeerRegistryEntry) => void
}) {
  const [draft, setDraft] = useState<DeerSubmission>(entry?.deerSubmission || defaultDeerSubmission())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function toggleAction(action: DeerSubmission['action']) {
    if (!canEdit) return
    const exists = draft.actionHistory.some((item) => item.action === action)
    if (!exists && !window.confirm('Confirmi că această acțiune a fost depusă efectiv pe portalul DEER? Bifa și data vor apărea în registru.')) return
    setDraft((current) => ({ ...current, actionHistory: exists
      ? current.actionHistory.filter((item) => item.action !== action)
      : [...current.actionHistory, { action, submittedAt: localDateToday() }] }))
    setNotice('')
  }

  async function save() {
    if (!canEdit) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/deer-registry`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deerSubmission: { ...draft, email: DEER_CONTACT_EMAIL } }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Registrul DEER nu a putut fi salvat.')
      setDraft(body.deerSubmission)
      onSaved(body as ProjectDeerRegistryEntry)
      setNotice('Înregistrarea proiectului a fost salvată în registrul DEER.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Registrul DEER nu a putut fi salvat.') }
    finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/50 p-3 lg:p-6" role="dialog" aria-modal="true" aria-label={`Registru DEER · ${project.name}`}>
    <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-[24px] bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div><p className="text-xs font-black uppercase tracking-wider text-[#197fb5]">Proiect · registru DEER</p><h2 className="mt-1 text-xl font-black text-[#082b4d]">{project.name}</h2><p className="mt-1 text-sm text-slate-500">{project.beneficiary || 'Beneficiar necompletat'} · {project.address || 'Adresă necompletată'}</p></div>
        <button type="button" className="round-action" onClick={onClose} aria-label="Închide"><X size={18}/></button>
      </div>
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Înregistrează acțiunile doar după depunerea lor efectivă pe portalul DEER. Formularul proiectului se poate salva și imprima separat.</p><span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: DEER_STATUS_META[draft.status].color }}>{DEER_STATUS_META[draft.status].label}</span></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">Număr dosar / ATR<input className="input-field mt-1.5 w-full" disabled={!canEdit} value={draft.dossierNumber} maxLength={200} onChange={(event) => setDraft({ ...draft, dossierNumber: event.target.value })}/></label>
          <label className="text-xs font-bold text-slate-600">Număr înregistrare DEER<input className="input-field mt-1.5 w-full" disabled={!canEdit} value={draft.registrationNumber} maxLength={300} onChange={(event) => setDraft({ ...draft, registrationNumber: event.target.value })}/></label>
          <label className="text-xs font-bold text-slate-600">Acțiunea de pregătit<select className="input-field mt-1.5 w-full" disabled={!canEdit} value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value as DeerSubmission['action'] })}>{DEER_ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-600">E-mail DEER<input className="input-field mt-1.5 w-full bg-slate-50" readOnly value={DEER_CONTACT_EMAIL}/></label>
        </div>
        <section className="rounded-2xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-bold text-[#082b4d]"><ClipboardList size={17}/> Acțiuni depuse efectiv</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{DEER_ACTIONS.map(([action, label]) => { const record = draft.actionHistory.find((item) => item.action === action); return <div key={action} className={`rounded-xl border p-3 ${record ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}><label className="flex items-start gap-2 text-xs font-bold text-slate-700"><input type="checkbox" className="mt-0.5" disabled={!canEdit || busy} checked={!!record} onChange={() => toggleAction(action)}/><span>{label}</span></label>{record && <input type="date" className="input-field mt-2 w-full bg-white" aria-label={`Data depunerii pentru ${label}`} disabled={!canEdit || busy} value={record.submittedAt} onChange={(event) => { if (event.target.value) setDraft((current) => ({ ...current, actionHistory: current.actionHistory.map((item) => item.action === action ? { ...item, submittedAt: event.target.value } : item) })) }}/>}</div> })}</div></section>
        <label className="block text-xs font-bold text-slate-600">Observații<textarea className="input-field mt-1.5 min-h-24 w-full resize-y" disabled={!canEdit} value={draft.notes} maxLength={4000} onChange={(event) => setDraft({ ...draft, notes: event.target.value })}/></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p>}
        <div className="flex flex-wrap justify-end gap-2"><a href="https://avize.distributie-energie.ro/solicitare" target="_blank" rel="noopener noreferrer" className="btn-secondary inline-flex items-center gap-2"><ExternalLink size={16}/> Deschide portalul DEER</a>{canEdit && <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={busy} onClick={save}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvează în registru</button>}</div>
      </div>
    </div>
  </div>
}
