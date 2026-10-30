'use client'

import { useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, ExternalLink, FileUp, FolderKanban, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import type { Tender } from '@/lib/tenders'
import { STANDARD_APPROVALS } from '@/lib/project-approvals'

type View = 'month' | 'week' | 'day'
type Draft = Pick<Tender, 'title' | 'noticeNumber' | 'contractingAuthority' | 'procedureType' | 'cpvCode' | 'publicationDate' | 'deadline' | 'estimatedValue' | 'currency' | 'status' | 'seapUrl' | 'notes'>
const WEEKDAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']
const STATUS: Record<string, { label: string; style: string }> = {
  NESELECTATA: { label: 'Neselectată', style: 'bg-slate-50 text-slate-700 border-slate-200' },
  INTERES: { label: 'Interes', style: 'bg-emerald-50 text-emerald-900 border-slate-200' },
  PREGATIRE: { label: 'În pregătire', style: 'bg-amber-100 text-amber-800 border-amber-200' },
  DEPUSA: { label: 'Depusă', style: 'bg-violet-100 text-violet-800 border-violet-200' },
  CASTIGATA: { label: 'Câștigată', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  PIERDUTA: { label: 'Necâștigată', style: 'bg-slate-100 text-slate-700 border-slate-200' },
  ANULATA: { label: 'Anulată', style: 'bg-rose-100 text-rose-800 border-rose-200' },
}
const pad = (n: number) => String(n).padStart(2, '0')
const key = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const dayDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`)
const addDays = (date: Date, count: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count, 12)
const monday = (date: Date) => addDays(date, -((date.getDay() + 6) % 7))
const formatDate = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleDateString('ro-RO', options)
const emptyDraft = (date: Date): Draft => ({ title: '', noticeNumber: null, contractingAuthority: null, procedureType: null, cpvCode: null, publicationDate: null, deadline: `${key(date)}T12:00`, estimatedValue: null, currency: 'RON', status: 'NESELECTATA', seapUrl: null, notes: null })

export function TendersManager({ initialTenders, today, canManage, canConvert }: { initialTenders: Tender[]; today: string; canManage: boolean; canConvert: boolean }) {
  const [tenders, setTenders] = useState(initialTenders)
  const [view, setView] = useState<View>('month')
  const [focus, setFocus] = useState(() => dayDate(today))
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Tender | null>(null)
  const [editing, setEditing] = useState<Tender | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState<Tender | null>(null)
  const [conversionName, setConversionName] = useState('')
  const [conversionBeneficiary, setConversionBeneficiary] = useState('')
  const [conversionAddress, setConversionAddress] = useState('')
  const [conversionApprovals, setConversionApprovals] = useState<string[]>([])
  const [conversionCustomApprovals, setConversionCustomApprovals] = useState('')
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('ro-RO')
    return q ? tenders.filter(item => [item.title, item.noticeNumber, item.contractingAuthority, item.cpvCode].some(value => value?.toLocaleLowerCase('ro-RO').includes(q))) : tenders
  }, [tenders, search])
  const byDay = useMemo(() => {
    const grouped = new Map<string, Tender[]>()
    for (const item of visible) grouped.set(item.deadline.slice(0, 10), [...(grouped.get(item.deadline.slice(0, 10)) || []), item])
    return grouped
  }, [visible])
  const first = view === 'month' ? monday(new Date(focus.getFullYear(), focus.getMonth(), 1, 12)) : view === 'week' ? monday(focus) : dayDate(key(focus))
  const days = Array.from({ length: view === 'month' ? 42 : view === 'week' ? 7 : 1 }, (_, i) => addDays(first, i))
  const heading = view === 'month' ? formatDate(focus, { month: 'long', year: 'numeric' }) : view === 'week' ? `${formatDate(days[0], { day: 'numeric', month: 'short' })} – ${formatDate(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}` : formatDate(focus, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  function move(amount: number) {
    setFocus(current => view === 'month' ? new Date(current.getFullYear(), current.getMonth() + amount, Math.min(current.getDate(), 28), 12) : addDays(current, amount * (view === 'week' ? 7 : 1)))
  }
  function openNew(date = focus) { setEditing(null); setDraft(emptyDraft(date)); setError('') }
  function openEdit(item: Tender) { setSelected(null); setEditing(item); setDraft({ title: item.title, noticeNumber: item.noticeNumber, contractingAuthority: item.contractingAuthority, procedureType: item.procedureType, cpvCode: item.cpvCode, publicationDate: item.publicationDate, deadline: item.deadline, estimatedValue: item.estimatedValue, currency: item.currency, status: item.status, seapUrl: item.seapUrl, notes: item.notes }); setError('') }
  function change<K extends keyof Draft>(name: K, value: Draft[K]) { setDraft(current => current ? { ...current, [name]: value } : current) }
  async function save() {
    if (!draft) return
    if (draft.title.trim().length < 3 || !draft.deadline) { setError('Completează denumirea și termenul de depunere.'); return }
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/tenders', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, id: editing?.id }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nu s-a putut salva licitația.')
      setTenders(data); setDraft(null); setEditing(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Eroare la salvare.') } finally { setSaving(false) }
  }
  async function remove(item: Tender) {
    if (!confirm(`Ștergi licitația „${item.title}”?`)) return
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/tenders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nu s-a putut șterge licitația.')
      setTenders(data); setSelected(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Eroare la ștergere.') } finally { setSaving(false) }
  }
  async function importFile(file: File | undefined) {
    if (!file) return
    setImporting(true); setError(''); setImportSummary('')
    try {
      const body = new FormData(); body.append('file', file)
      const response = await fetch('/api/tenders/import', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Importul nu a reușit.')
      setTenders(data.tenders)
      const next = (data.tenders as Tender[]).find(item => item.deadline >= `${today}T00:00`)
      if (next) { setFocus(dayDate(next.deadline)); setView('month') }
      setImportSummary(`${data.imported} noi · ${data.updated} actualizate · ${data.duplicates} duplicate omise${data.invalid ? ` · ${data.invalid} rânduri invalide` : ''}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Importul nu a reușit.') }
    finally { setImporting(false); if (importRef.current) importRef.current.value = '' }
  }
  async function toggleInterest(item: Tender) {
    setSaving(true); setError('')
    try {
      const { id, title, noticeNumber, contractingAuthority, procedureType, cpvCode, publicationDate, deadline, estimatedValue, currency, status, seapUrl, notes } = item
      const response = await fetch('/api/tenders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title, noticeNumber, contractingAuthority, procedureType, cpvCode, publicationDate, deadline, estimatedValue, currency, status: status === 'INTERES' ? 'NESELECTATA' : 'INTERES', seapUrl, notes }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nu s-a putut actualiza licitația.')
      setTenders(data); setSelected(data.find((entry: Tender) => entry.id === id) || null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Eroare la actualizare.') }
    finally { setSaving(false) }
  }
  function openConversion(item: Tender) {
    setSelected(null)
    setConverting(item)
    setConversionName(item.title.slice(0, 200))
    setConversionBeneficiary('')
    setConversionAddress('')
    setConversionApprovals([])
    setConversionCustomApprovals('')
    setError('')
  }
  async function convertToProject() {
    if (!converting) return
    setSaving(true); setError('')
    try {
      const approvals = [...conversionApprovals, ...conversionCustomApprovals.split(/[,;\n]/).map(value => value.trim()).filter(Boolean)]
      const response = await fetch(`/api/tenders/${converting.id}/convert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: conversionName, beneficiary: conversionBeneficiary, address: conversionAddress, approvals }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Proiectul nu a putut fi creat.')
      window.location.assign(`/dashboard/proiecte?project=${encodeURIComponent(data.projectId)}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Proiectul nu a putut fi creat.') }
    finally { setSaving(false) }
  }

  return <div className="flex min-h-[calc(100dvh-6rem)] flex-col gap-4 text-[#082b4d]">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#197fb5]">Achiziții publice</p><h1 className="mt-1 text-3xl font-bold">Licitații</h1><p className="mt-1 text-sm text-slate-500">Termenele și informațiile importante din SEAP, într-un singur calendar.</p></div>{canManage && <div className="flex flex-wrap gap-2"><input ref={importRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={event => importFile(event.target.files?.[0])} /><button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={importing} onClick={() => importRef.current?.click()}><FileUp size={17}/>{importing ? 'Se importă…' : 'Import Excel / CSV'}</button><button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => openNew()}><Plus size={17} /> Adaugă licitație</button></div>}</header>
    {importSummary && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{importSummary}</p>}
    <section className="card flex flex-1 flex-col overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div className="flex items-center gap-2"><CalendarDays className="text-[#197fb5]" size={21} /><h2 className="text-lg font-bold capitalize">{heading}</h2></div><div className="flex flex-wrap items-center gap-2"><button type="button" className="btn-secondary !px-3" onClick={() => move(-1)} aria-label="Perioada anterioară"><ChevronLeft size={18}/></button><button type="button" className="btn-secondary" onClick={() => setFocus(dayDate(today))}>Azi</button><button type="button" className="btn-secondary !px-3" onClick={() => move(1)} aria-label="Perioada următoare"><ChevronRight size={18}/></button><div className="ml-1 flex rounded-xl border border-slate-200 p-1">{([['month','Lună'],['week','Săptămână'],['day','Zi']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setView(value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === value ? 'bg-[#0d5d8b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</div></div></div>
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><Search size={17} className="text-slate-400"/><input className="w-full bg-transparent text-sm outline-none" value={search} onChange={event => setSearch(event.target.value)} placeholder="Caută după denumire, număr SEAP, autoritate sau CPV" /></div>
      <div className="flex flex-1 flex-col overflow-x-auto"><div className={`flex flex-1 flex-col ${view === 'day' ? 'min-w-[420px]' : 'min-w-[800px]'}`}>
        {view !== 'day' && <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{WEEKDAYS.map(name => <div key={name} className="px-2 py-1.5 text-center text-xs font-bold text-slate-500">{name}</div>)}</div>}
        <div className={`grid flex-1 ${view === 'day' ? 'grid-cols-1' : view === 'week' ? 'grid-cols-7' : 'grid-cols-7 grid-rows-6'}`}>{days.map(date => {
          const items = byDay.get(key(date)) || []
          const isToday = key(date) === today
          return <div key={key(date)} className={`${view === 'day' ? 'min-h-[360px]' : view === 'week' ? 'min-h-[120px]' : 'min-h-[88px]'} border-b border-r border-slate-200 p-1.5 ${date.getMonth() !== focus.getMonth() && view === 'month' ? 'bg-slate-50/70' : 'bg-white'}`}>
            <div className="mb-1 flex items-center"><button type="button" onClick={() => { setFocus(date); setView('day') }} className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-[#0d5d8b] text-white' : 'hover:bg-slate-100'}`}>{date.getDate()}</button></div>
            <div className="space-y-1">{items.map(item => <button type="button" key={item.id} title={item.title} onClick={() => setSelected(item)} className={`w-full rounded-lg border px-1.5 py-1 text-left text-xs ${STATUS[item.status]?.style || STATUS.NESELECTATA.style}`}><span className="flex items-start gap-1 font-bold">{item.status === 'INTERES' && <Check size={18} strokeWidth={4} className="shrink-0 text-emerald-600" aria-label="Interes" />}<span className="line-clamp-2 min-w-0 break-words">{item.title}</span></span></button>)}</div>
          </div>
        })}</div>
      </div></div>
    </section>
    {selected && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }}>
      <div role="dialog" aria-modal="true" aria-label="Detalii licitație" className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex justify-between gap-3"><div><span className={`rounded-lg border px-2 py-1 text-xs font-bold ${STATUS[selected.status]?.style}`}>{STATUS[selected.status]?.label}</span><h2 className="mt-3 text-xl font-bold">{selected.title}</h2></div><button onClick={() => setSelected(null)} aria-label="Închide"><X size={20}/></button></div>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">{[['Număr SEAP',selected.noticeNumber],['Autoritate contractantă',selected.contractingAuthority],['Termen depunere',selected.deadline.replace('T',' · ')],['Valoare estimată',selected.estimatedValue === null ? null : `${selected.estimatedValue.toLocaleString('ro-RO')} ${selected.currency}`],['Tip procedură',selected.procedureType],['Cod CPV',selected.cpvCode],['Data publicării',selected.publicationDate],['Note',selected.notes]].filter(([,value]) => value).map(([label,value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><span className="block text-xs font-semibold text-slate-500">{label}</span><span className="mt-1 block whitespace-pre-wrap">{value}</span></div>)}</div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {canManage && <button type="button" title="Marchează sau elimină interesul" aria-label={selected.status === 'INTERES' ? 'Elimină marcajul de interes' : 'Marchează interesul'} aria-pressed={selected.status === 'INTERES'} disabled={saving} onClick={() => toggleInterest(selected)} className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 ${selected.status === 'INTERES' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-400 hover:border-emerald-500 hover:text-emerald-600'}`}><Check size={27} strokeWidth={4}/></button>}
          {selected.seapUrl && <a className="btn-secondary inline-flex items-center gap-2" href={selected.seapUrl} target="_blank" rel="noopener noreferrer">Deschide în SEAP <ExternalLink size={15}/></a>}
          {selected.projectId ? <a className="btn-primary inline-flex items-center gap-2" href={`/dashboard/proiecte?project=${encodeURIComponent(selected.projectId)}`}><FolderKanban size={16}/> Deschide proiectul</a> : canConvert && selected.status === 'CASTIGATA' ? <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => openConversion(selected)}><FolderKanban size={16}/> Transformă în proiect</button> : null}
          {canManage && <><button className="btn-primary inline-flex items-center gap-2" onClick={() => openEdit(selected)}><Pencil size={15}/> Editează</button><button className="btn-secondary inline-flex items-center gap-2 !text-rose-700" disabled={saving} onClick={() => remove(selected)}><Trash2 size={15}/> Șterge</button></>}
        </div>
      </div>
    </div>}
    {converting && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setConverting(null) }}>
      <div role="dialog" aria-modal="true" aria-label="Transformă licitația în proiect" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Transformă licitația în proiect</h2><button type="button" onClick={() => setConverting(null)} aria-label="Închide"><X size={20}/></button></div>
        <p className="mt-2 text-sm text-slate-500">Proiectul va păstra numărul SEAP, autoritatea, termenul, valoarea și notele licitației. Avizele selectate pot fi urmărite apoi în Proiecte.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Numele proiectului *" wide><input maxLength={200} required value={conversionName} onChange={event => setConversionName(event.target.value)} /></Field>
          <Field label="Beneficiar"><input maxLength={200} value={conversionBeneficiary} onChange={event => setConversionBeneficiary(event.target.value)} /></Field>
          <Field label="Amplasament / adresă"><input maxLength={500} value={conversionAddress} onChange={event => setConversionAddress(event.target.value)} /></Field>
        </div>
        <div className="mt-5"><p className="text-sm font-bold">Avize necesare</p><p className="mt-1 text-xs text-slate-500">Selectează doar avizele cerute pentru acest proiect. MEDIU este opțional.</p><div className="mt-3 flex flex-wrap gap-2">{STANDARD_APPROVALS.map(name => <label key={name} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold"><input type="checkbox" checked={conversionApprovals.includes(name)} onChange={event => setConversionApprovals(current => event.target.checked ? [...current, name] : current.filter(value => value !== name))} />{name}</label>)}</div></div>
        <Field label="Alte avize (separate prin virgulă)" wide><input value={conversionCustomApprovals} onChange={event => setConversionCustomApprovals(event.target.value)} placeholder="Ex. Apele Române, Drumuri Județene" /></Field>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setConverting(null)}>Anulează</button><button type="button" className="btn-primary" disabled={saving || conversionName.trim().length < 2} onClick={convertToProject}>{saving ? 'Se creează…' : 'Creează proiectul'}</button></div>
      </div>
    </div>}
    {draft && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setDraft(null) }}><div role="dialog" aria-modal="true" aria-label="Formular licitație" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{editing ? 'Editează licitația' : 'Adaugă licitație'}</h2><button onClick={() => setDraft(null)} aria-label="Închide"><X size={20}/></button></div><div className="grid gap-4 sm:grid-cols-2">
      <Field label="Denumire licitație *" wide><input required maxLength={300} value={draft.title} onChange={event => change('title', event.target.value)} /></Field>
      <Field label="Număr anunț SEAP"><input placeholder="ex. SCN1181452" value={draft.noticeNumber || ''} onChange={event => change('noticeNumber', event.target.value)} /></Field>
      <Field label="Autoritate contractantă"><input value={draft.contractingAuthority || ''} onChange={event => change('contractingAuthority', event.target.value)} /></Field>
      <Field label="Data limită de depunere *"><input type="datetime-local" required value={draft.deadline} onChange={event => change('deadline', event.target.value)} /></Field>
      <Field label="Data publicării"><input type="date" value={draft.publicationDate || ''} onChange={event => change('publicationDate', event.target.value)} /></Field>
      <Field label="Valoare estimată"><input type="number" min="0" step="0.01" value={draft.estimatedValue ?? ''} onChange={event => change('estimatedValue', event.target.value === '' ? null : Number(event.target.value))} /></Field>
      <Field label="Monedă"><select value={draft.currency} onChange={event => change('currency', event.target.value)}><option>RON</option><option>EUR</option></select></Field>
      <Field label="Tip procedură"><input placeholder="ex. Procedură simplificată" value={draft.procedureType || ''} onChange={event => change('procedureType', event.target.value)} /></Field>
      <Field label="Cod CPV"><input placeholder="ex. 45231400-9" value={draft.cpvCode || ''} onChange={event => change('cpvCode', event.target.value)} /></Field>
      <Field label="Stadiu"><select value={draft.status} onChange={event => change('status', event.target.value)}>{Object.entries(STATUS).map(([value,meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></Field>
      <Field label="Link către anunțul SEAP" wide><input type="url" placeholder="https://e-licitatie.ro/..." value={draft.seapUrl || ''} onChange={event => change('seapUrl', event.target.value)} /></Field>
      <Field label="Note / documente necesare" wide><textarea rows={4} value={draft.notes || ''} onChange={event => change('notes', event.target.value)} /></Field>
    </div>{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setDraft(null)}>Anulează</button><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Se salvează…' : 'Salvează licitația'}</button></div></div></div>}
    {!draft && error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  </div>
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block text-xs font-bold text-slate-600 ${wide ? 'sm:col-span-2' : ''}`}>{label}<div className="mt-1 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-sm [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-200 [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-sm [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:text-sm">{children}</div></label>
}
