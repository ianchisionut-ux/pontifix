'use client'

import { useState } from 'react'
import { CreditCard, FileUp, Loader2, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { IdentityCardRecord } from '@/lib/identity-card-storage'
import type { IdentityCardData } from '@/lib/browser-identity-card-ocr'

const EMPTY: IdentityCardData = { fullName: '', cnp: '', series: '', number: '', domicile: '', issuedBy: '', validFrom: '', validUntil: '' }
const FIELDS: Array<[keyof IdentityCardData, string]> = [
  ['fullName', 'Nume și prenume'], ['cnp', 'CNP'], ['series', 'Serie CI'], ['number', 'Număr CI'],
  ['domicile', 'Domiciliu'], ['issuedBy', 'Emisă de'], ['validFrom', 'Valabilă de la'], ['validUntil', 'Valabilă până la'],
]

type ConnectionOption = { id: string; nib: string; beneficiary: string }

export function IdentityCardScanner({ records, connections, canEdit, connectionId }: {
  records: IdentityCardRecord[]
  connections: ConnectionOption[]
  canEdit: boolean
  connectionId?: string
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<IdentityCardData>(EMPTY)
  const [selectedConnectionId, setSelectedConnectionId] = useState(connectionId || '')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const visible = connectionId ? records.filter((record) => record.connectionCaseId === connectionId) : records

  async function scan(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return setNotice('Selectează o imagine sau un PDF scanat.')
    if (file.size > 15 * 1024 * 1024) return setNotice('Fișierul poate avea maximum 15 MB.')
    setBusy('scan'); setNotice('Pornesc citirea locală…')
    try {
      const { analyzeIdentityCardInBrowser } = await import('@/lib/browser-identity-card-ocr')
      const data = await analyzeIdentityCardInBrowser(file, setNotice)
      setDraft(data)
      setNotice('Date extrase. Verifică și corectează înainte de salvare. Imaginea nu a fost încărcată și nu este păstrată.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'CI nu a putut fi citită.') }
    finally { setBusy('') }
  }

  async function save() {
    if (!draft.fullName.trim()) return setNotice('Completează numele titularului.')
    setBusy('save')
    const response = await fetch('/api/identity-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, connectionCaseId: connectionId || selectedConnectionId || null }) })
    const body = await response.json().catch(() => ({})); setBusy('')
    if (!response.ok) return setNotice(body.error || 'Datele CI nu au putut fi salvate.')
    setDraft(EMPTY); setNotice('Datele CI au fost salvate fără imagine.'); router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Ștergi definitiv aceste date CI?')) return
    const response = await fetch(`/api/identity-cards/${id}`, { method: 'DELETE' })
    if (!response.ok) return alert('Datele CI nu au putut fi șterse.')
    router.refresh()
  }

  async function relink(id: string, nextConnectionId: string) {
    const response = await fetch(`/api/identity-cards/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionCaseId: nextConnectionId || null }) })
    if (!response.ok) return alert('Asocierea nu a putut fi salvată.')
    router.refresh()
  }

  return <div className="space-y-5">
    {canEdit && <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><CreditCard size={20} className="text-[#197fb5]"/><h2 className="font-bold text-[#082b4d]">Scanner carte de identitate</h2></div><p className="mt-1 max-w-3xl text-sm text-slate-500">OCR local pentru CI scanată. Fișierul nu este încărcat și nu este stocat; se salvează numai datele pe care le verifici.</p></div><label className="btn-primary inline-flex cursor-pointer items-center gap-2"><FileUp size={17}/>{busy === 'scan' ? 'Se citește…' : 'Scanează CI'}<input type="file" accept="image/*,application/pdf,.pdf" className="hidden" disabled={!!busy} onChange={(event) => { scan(event.target.files?.[0]); event.currentTarget.value = '' }}/></label></div>
      {notice && <p className={`mt-4 rounded-xl px-3 py-2 text-sm font-semibold ${notice.includes('nu ') || notice.includes('maximum') ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>{notice}</p>}
      {busy === 'scan' && <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#197fb5]"/></div>}
      <div className="mt-5 grid gap-3 md:grid-cols-2">{FIELDS.map(([field, label]) => <label key={field} className={`text-xs font-bold text-slate-500 ${field === 'domicile' ? 'md:col-span-2' : ''}`}>{label}<input value={draft[field]} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} className="input-field mt-1.5 w-full bg-white"/></label>)}</div>
      {!connectionId && <label className="mt-4 block text-xs font-bold text-slate-500">Asociază opțional cu branșamentul<select value={selectedConnectionId} onChange={(event) => setSelectedConnectionId(event.target.value)} className="input-field mt-1.5 w-full bg-white"><option value="">Fără branșament</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.nib} - {connection.beneficiary || 'Beneficiar necompletat'}</option>)}</select></label>}
      <div className="mt-5 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><ShieldCheck size={15}/> Nu se păstrează poza sau PDF-ul.</span><button onClick={save} disabled={!!busy || !draft.fullName.trim()} className="btn-primary inline-flex items-center gap-2">{busy === 'save' ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvează datele</button></div>
    </section>}

    <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><CreditCard size={18} className="text-[#197fb5]"/><h2 className="font-bold text-[#082b4d]">Date CI salvate</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{visible.length}</span></div>
      {visible.length ? <div className="grid gap-3 xl:grid-cols-2">{visible.map((record) => <article key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-[#082b4d]">{record.fullName}</h3><p className="mt-1 text-xs text-slate-400">Salvat {new Date(record.createdAt).toLocaleString('ro-RO')}</p></div>{canEdit && <button onClick={() => remove(record.id)} className="round-action !text-red-600" title="Șterge datele CI"><Trash2 size={15}/></button>}</div><dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2"><div><dt className="text-[11px] font-bold text-slate-400">CNP</dt><dd className="font-semibold text-slate-700">{record.cnp || '—'}</dd></div><div><dt className="text-[11px] font-bold text-slate-400">Serie / număr</dt><dd className="font-semibold text-slate-700">{[record.series, record.number].filter(Boolean).join(' ') || '—'}</dd></div><div className="sm:col-span-2"><dt className="text-[11px] font-bold text-slate-400">Domiciliu</dt><dd className="font-semibold text-slate-700">{record.domicile || '—'}</dd></div><div><dt className="text-[11px] font-bold text-slate-400">Emisă de</dt><dd className="font-semibold text-slate-700">{record.issuedBy || '—'}</dd></div><div><dt className="text-[11px] font-bold text-slate-400">Valabilitate</dt><dd className="font-semibold text-slate-700">{[record.validFrom, record.validUntil].filter(Boolean).join(' - ') || '—'}</dd></div></dl>{canEdit && !connectionId && <label className="mt-4 block text-[11px] font-bold text-slate-400">Branșament asociat<select value={record.connectionCaseId || ''} onChange={(event) => relink(record.id, event.target.value)} className="input-field mt-1 w-full bg-white text-sm"><option value="">Fără branșament</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.nib} - {connection.beneficiary}</option>)}</select></label>}</article>)}</div> : <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Nu există date CI pentru această secțiune.</p>}
    </section>
  </div>
}