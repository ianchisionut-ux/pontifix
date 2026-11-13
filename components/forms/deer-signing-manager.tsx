'use client'

import { useEffect, useState } from 'react'
import { uploadPresigned } from '@vercel/blob/client'
import { Check, Copy, ExternalLink, Link2, Loader2, RefreshCw, X } from 'lucide-react'
import type { FormSubmissionDto, FormTemplateDto } from '@/lib/ensure-form-storage'
import type { DeerDocumentKind } from '@/lib/deer-borderou-shared'
import type { ConnectionFormOption } from './pdf-request-editor'
import { buildDeerSigningBundle, type SigningDocument } from '@/lib/deer-signing-bundle'

type Row = { id: string; documents: SigningDocument[]; createdAt: string; expiresAt: string; revokedAt: string | null; completedAt: string | null; acceptedName: string | null }

export function DeerSigningManager({ connection, templates, submissions, caseDocumentIds, onClose }: {
  connection: ConnectionFormOption; templates: FormTemplateDto[]; submissions: FormSubmissionDto[];
  caseDocumentIds: Partial<Record<DeerDocumentKind, string>>; onClose: () => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function refresh() {
    const response = await fetch(`/api/formulare/deer-signing?connectionId=${encodeURIComponent(connection.id)}`, { cache: 'no-store' })
    if (response.ok) { const result = await response.json(); setRows(result.requests || []) }
  }
  useEffect(() => { void refresh() }, [connection.id])
  async function create() {
    setBusy(true); setError(''); setLink('')
    try {
      const bundle = await buildDeerSigningBundle(templates, submissions, connection, caseDocumentIds, setProgress)
      if (bundle.bytes.length > 20 * 1024 * 1024) throw new Error('Pachetul depășește 20 MB. Redu dimensiunea PDF-urilor.')
      setProgress('Încarc versiunea fixă a documentelor')
      const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bundle.bytes).buffer)
      const bundleHash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
      const pathname = `formulare/deer-signing/${connection.id}/${crypto.randomUUID()}.pdf`
      const blob = await uploadPresigned(pathname, new Blob([bundle.bytes as BlobPart], { type: 'application/pdf' }), { access: 'private', handleUploadUrl: '/api/formulare/upload' })
      setProgress('Creez linkul privat')
      const response = await fetch('/api/formulare/deer-signing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionId: connection.id, bundlePathname: blob.pathname, bundleHash, documents: bundle.documents }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Linkul nu a putut fi creat.')
      setLink(result.link)
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Linkul nu a putut fi creat.') }
    finally { setBusy(false); setProgress('') }
  }
  async function revoke(id: string) {
    if (!confirm('Anulezi linkul activ? Beneficiarul nu îl va mai putea folosi.')) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/formulare/deer-signing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionId: connection.id, id }) })
      if (!response.ok) throw new Error('Linkul nu a putut fi anulat.')
      setLink(''); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Anularea a eșuat.') }
    finally { setBusy(false) }
  }
  async function copy() { try { await navigator.clipboard.writeText(link); setCopied(true) } catch { setError('Copiază linkul din câmpul de mai jos.') } }
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-3 sm:p-6"><div role="dialog" aria-modal="true" aria-labelledby="deer-signing-title" className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
    <div className="flex items-start gap-3"><div className="flex-1"><h2 id="deer-signing-title" className="text-xl font-extrabold text-[#082b4d]">Link de analiză și semnare</h2><p className="mt-1 text-sm text-slate-600">{connection.fields.Beneficiar} · {connection.nib}</p></div><button type="button" className="round-action" onClick={onClose} aria-label="Închide"><X size={18}/></button></div>
    <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm leading-relaxed text-[#082b4d]"><b>Cum funcționează</b><p className="mt-1">Pregătești documentele completate din DEER și poziționezi „Semnătura beneficiarului” pe fiecare document unde trebuie. Creezi linkul, îl copiezi și îl trimiți tu manual. Beneficiarul deschide PDF-ul pe telefon, confirmă documentele și semnează. Linkul expiră după 7 zile.</p><p className="mt-2">Un link nou anulează linkul activ anterior. Păstrează linkul privat și verifică identitatea destinatarului înainte de trimitere.</p></div>
    <button type="button" className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 sm:w-auto" disabled={busy} onClick={create}>{busy ? <Loader2 size={17} className="animate-spin"/> : <Link2 size={17}/>} {busy ? progress || 'Pregătesc…' : 'Creează link de semnare'}</button>
    {link && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><b className="text-emerald-900">Linkul este gata. Trimite-l beneficiarului pe canalul ales de tine.</b><input readOnly className="input-field mt-3 !w-full bg-white text-xs" value={link} onFocus={(event) => event.target.select()}/><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={copy}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Copiat' : 'Copiază linkul'}</button><a href={link} target="_blank" rel="noopener noreferrer" className="btn-secondary inline-flex items-center gap-2"><ExternalLink size={16}/> Verifică pagina</a></div><p className="mt-2 text-xs text-slate-600">Linkul complet este afișat o singură dată. Dacă îl pierzi, creează unul nou.</p></div>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
    <div className="mt-6"><div className="flex items-center justify-between"><h3 className="font-bold text-[#082b4d]">Istoric linkuri</h3><button type="button" className="round-action" onClick={() => void refresh()} aria-label="Actualizează"><RefreshCw size={16}/></button></div><div className="mt-2 space-y-2">{rows.length ? rows.map((row) => { const active = !row.revokedAt && !row.completedAt && new Date(row.expiresAt) > new Date(); return <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><div className="min-w-[200px] flex-1"><b className="block">{row.completedAt ? 'Semnat' : row.revokedAt ? 'Anulat' : active ? 'În așteptare' : 'Expirat'}</b><span className="text-xs text-slate-500">Creat {new Date(row.createdAt).toLocaleString('ro-RO')} · {row.documents.length} documente</span>{row.completedAt && <span className="block text-xs text-slate-600">{row.acceptedName} · {new Date(row.completedAt).toLocaleString('ro-RO')}</span>}</div>{row.completedAt && <a href={`/api/formulare/deer-signing/${row.id}/signed`} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-3 !py-2 text-xs">PDF semnat</a>}{row.completedAt && <a href={`/api/formulare/deer-signing/${row.id}/evidence`} className="btn-secondary !px-3 !py-2 text-xs">Dovadă semnare</a>}{active && <button type="button" className="btn-secondary !px-3 !py-2 text-xs text-red-700" disabled={busy} onClick={() => revoke(row.id)}>Anulează</button>}</div> }) : <p className="text-sm text-slate-500">Nu există linkuri pentru acest dosar.</p>}</div></div>
  </div></div>
}
