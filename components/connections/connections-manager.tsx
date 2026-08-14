'use client'

import { useMemo, useRef, useState } from 'react'
import { uploadPresigned } from '@vercel/blob/client'
import { Archive, Download, Eye, FileText, FileUp, LayoutGrid, List, Loader2, Plus, Save, Search, ShieldCheck, Trash2, WandSparkles, X } from 'lucide-react'
import { CONNECTION_FIELD_GROUPS, CONNECTION_FIELD_LABELS, defaultConnectionFields, type ConnectionCaseDto, type ConnectionFields } from '@/lib/connection-fields'
import { CONNECTION_STATUSES, CONNECTION_STATUS_META, type ConnectionStatus } from '@/lib/connection-status'

function addressHints(address: string) {
  const county = address.match(/jud(?:ețul|\.)?\s*([^,]+)/i)?.[1]?.trim() || 'Sălaj'
  const city = address.match(/(?:mun(?:icipiul|\.)?|oraș(?:ul)?)\s*([^,]+)/i)?.[1]?.trim() || ''
  const street = address.match(/(?:strada|str\.)\s*([^,]+)/i)?.[1]?.trim() || ''
  const number = address.match(/(?:nr\.|numărul)\s*([\w/-]+)/i)?.[1]?.trim() || ''
  return { county, city, street, number }
}

export function ConnectionsManager({ initialCases, canManage }: { initialCases: ConnectionCaseDto[]; canManage: boolean }) {
  const [items, setItems] = useState(initialCases)
  const [selectedId, setSelectedId] = useState(initialCases[0]?.id || '')
  const selected = items.find((item) => item.id === selectedId) || null
  const [draft, setDraft] = useState<ConnectionFields>(selected?.fields || defaultConnectionFields())
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => items.filter((item) => {
    const haystack = `${item.nib} ${item.sequenceNumber} ${item.fields.Beneficiar} ${item.fields.Telefon} ${item.fields.ATR} ${item.fields.Amplasament}`.toLocaleLowerCase('ro-RO')
    return haystack.includes(query.toLocaleLowerCase('ro-RO'))
  }), [items, query])

  function select(item: ConnectionCaseDto) {
    setSelectedId(item.id)
    setDraft({ ...defaultConnectionFields(), ...item.fields })
    setNotice('')
  }

  async function createCase(file?: File) {
    if (!canManage) return
    if (file && file.type !== 'application/pdf') return alert('ATR-ul trebuie să fie PDF.')
    if (file && file.size > 20 * 1024 * 1024) return alert('ATR-ul poate avea maximum 20 MB.')
    setBusy('create')
    setNotice(file ? 'Citesc ATR-ul…' : 'Creez fișa…')
    try {
      const fields = defaultConnectionFields()
      let atrPathname: string | null = null
      let atrName: string | null = null
      if (file) {
        try {
          const { analyzeAtrInBrowser } = await import('@/lib/browser-atr-ocr')
          const ocr = await analyzeAtrInBrowser(file, setNotice)
          const hints = addressHints(ocr.workAddress)
          fields.Beneficiar = ocr.customerName
          fields.Telefon = ocr.customerPhone
          fields.Amplasament = ocr.workAddress
          fields.AmplasamentA3 = ocr.workAddress || fields.AmplasamentA3
          fields.ATR = [ocr.atrNumber && `nr. ${ocr.atrNumber}`, ocr.atrDate && `din ${ocr.atrDate}`].filter(Boolean).join(' ')
          fields.Judet = hints.county
          fields.Oras = hints.city
          fields.Strada = hints.street
          fields.Nr = hints.number
        } catch {
          setNotice('OCR-ul nu a găsit toate datele. ATR-ul se salvează și completezi manual.')
        }
        setNotice('Salvez ATR-ul în dosar…')
        const blob = await uploadPresigned(`bransamente/${crypto.randomUUID()}/${file.name}`, file, { access: 'private', handleUploadUrl: '/api/bransamente/upload' })
        atrPathname = blob.pathname
        atrName = file.name
      }
      const response = await fetch('/api/bransamente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields, atrPathname, atrName }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Fișa nu a putut fi creată.')
      window.location.reload()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Fișa nu a putut fi creată.')
      setBusy('')
      setNotice('')
    }
  }

  async function save() {
    if (!selected || !canManage) return
    setBusy('save')
    const response = await fetch(`/api/bransamente/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: draft }) })
    const body = await response.json().catch(() => ({}))
    setBusy('')
    if (!response.ok) return alert(body.error || 'Datele nu au putut fi salvate.')
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, fields: { ...draft }, updatedAt: new Date().toISOString() } : item))
    setNotice('Date salvate. Documentele Word sunt pregătite cu valorile actuale.')
  }

  async function changeStatus(status: ConnectionStatus) {
    if (!selected || !canManage) return
    setBusy('status')
    const response = await fetch(`/api/bransamente/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    const body = await response.json().catch(() => ({}))
    setBusy('')
    if (!response.ok) return alert(body.error || 'Stadiul nu a putut fi salvat.')
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, status, updatedAt: new Date().toISOString() } : item))
    setNotice(`Stadiu actualizat: ${CONNECTION_STATUS_META[status].label}.`)
  }
  async function remove() {
    if (!selected || !canManage || !confirm(`Ștergi definitiv dosarul ${selected.fields.Beneficiar || 'fără nume'}?`)) return
    setBusy('delete')
    const response = await fetch(`/api/bransamente/${selected.id}`, { method: 'DELETE' })
    setBusy('')
    if (!response.ok) return alert('Dosarul nu a putut fi șters.')
    const remaining = items.filter((item) => item.id !== selected.id)
    setItems(remaining)
    setSelectedId(remaining[0]?.id || '')
    setDraft(remaining[0]?.fields || defaultConnectionFields())
  }

  function clearGroup(fields: readonly string[]) {
    if (!canManage) return
    setDraft((current) => ({ ...current, ...Object.fromEntries(fields.map((field) => [field, ''])) } as ConnectionFields))
  }

  return <div>
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><span className="text-xs font-black uppercase tracking-[.16em] text-[#197fb5]">Documentații electrice</span><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#082b4d]">Branșamente</h1><p className="mt-1 text-sm text-slate-500">ATR → verificare date → contract, notificare, memoriu și dosar A3.</p></div>
      <div className="flex flex-wrap items-center gap-2"><div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Mod de vizualizare"><button type="button" onClick={() => setViewMode('list')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${viewMode === 'list' ? 'bg-[#0d5d8b] text-white' : 'text-slate-500 hover:bg-slate-50'}`} title="Lista compacta"><List size={17}/><span className="hidden sm:inline">Lista</span></button><button type="button" onClick={() => setViewMode('grid')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${viewMode === 'grid' ? 'bg-[#0d5d8b] text-white' : 'text-slate-500 hover:bg-slate-50'}`} title="Grila extinsa"><LayoutGrid size={17}/><span className="hidden sm:inline">Grila</span></button></div>{canManage ? <><input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => createCase(event.target.files?.[0])}/><button onClick={() => fileInput.current?.click()} disabled={!!busy} className="btn-primary inline-flex items-center gap-2">{busy === 'create' ? <Loader2 size={17} className="animate-spin"/> : <FileUp size={17}/>} Încarcă ATR</button><button onClick={() => createCase()} disabled={!!busy} className="btn-secondary inline-flex items-center gap-2"><Plus size={17}/> Fișă fără ATR</button></> : <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600"><Eye size={16}/> Mod vizualizare</span>}</div>
    </header>
    <div className={`grid min-h-[720px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm ${viewMode === 'list' ? 'xl:grid-cols-[300px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
      <aside className={`border-b border-slate-200 bg-[#f5f9fc] p-4 ${viewMode === 'list' ? 'xl:border-b-0 xl:border-r' : ''}`}>
        <div className="mb-3 flex items-center justify-between"><div><p className="font-bold text-[#082b4d]">Istoric dosare</p><p className="text-xs text-slate-500">{items.length} înregistrări</p></div><Archive size={19} className="text-[#197fb5]"/></div>
        <label className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"><Search size={15} className="text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută beneficiar…" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label>
        <div className={viewMode === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-2 xl:max-h-[620px] xl:overflow-y-auto xl:pr-1'}>{visible.map((item) => <button key={item.id} onClick={() => select(item)} className={`w-full rounded-2xl border p-3 text-left transition ${item.id === selectedId ? 'border-[#78bfe1] bg-white shadow-sm' : 'border-transparent bg-[#e9f1f8] hover:border-slate-200 hover:bg-white'}`}><div className="mb-1 flex items-center justify-between gap-2"><span className="text-[10px] font-black text-[#197fb5]">#{item.sequenceNumber} / {item.nib}</span><span className="h-2 w-2 rounded-full" style={{ backgroundColor: CONNECTION_STATUS_META[item.status].color }}/></div><p className="truncate text-sm font-black text-[#082b4d]">{item.fields.Beneficiar || 'Beneficiar necompletat'}</p><p className="mt-1 truncate text-xs text-slate-500">{item.fields.ATR || item.atrName || 'Fișă fără ATR'}</p>{viewMode === 'grid' && <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3"><span className="truncate text-xs font-semibold text-slate-500">{item.fields.Telefon || 'Telefon necompletat'}</span><span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-black text-white" style={{ backgroundColor: CONNECTION_STATUS_META[item.status].color }}>{CONNECTION_STATUS_META[item.status].label}</span></div>}<p className="mt-1 text-[11px] text-slate-400">{new Date(item.updatedAt).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })}</p></button>)}{!visible.length && <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Niciun dosar găsit.</p>}</div>
      </aside>
      <section className="min-w-0 p-5 lg:p-7">{selected ? <>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5"><div><div className="flex items-center gap-2"><WandSparkles size={20} className="text-[#197fb5]"/><h2 className="text-xl font-bold text-[#082b4d]">{draft.Beneficiar || 'Fișă branșament'}</h2></div><div className="mt-2 flex flex-wrap items-center gap-2"><strong className="rounded-lg bg-[#edf7fc] px-2.5 py-1 text-xs text-[#0d5d8b]">{selected.nib}</strong><span className="rounded-lg px-2.5 py-1 text-xs font-bold text-white" style={{ backgroundColor: CONNECTION_STATUS_META[selected.status].color }}>{CONNECTION_STATUS_META[selected.status].label} · {CONNECTION_STATUS_META[selected.status].progress}%</span></div><p className="mt-1 text-xs text-slate-500">Creat de {selected.createdByEmail || 'administrator'} · actualizat {new Date(selected.updatedAt).toLocaleString('ro-RO')}</p>{notice && <p className="mt-2 text-sm font-semibold text-emerald-600">{notice}</p>}</div><div className="flex flex-wrap gap-2">{canManage && <select value={selected.status} disabled={busy === 'status'} onChange={(event) => changeStatus(event.target.value as ConnectionStatus)} className="input-field min-w-[210px] bg-white text-sm font-bold">{CONNECTION_STATUSES.map((status) => <option key={status} value={status}>{CONNECTION_STATUS_META[status].label}</option>)}</select>}{canManage && <> {selected.atrPathname && <a href={`/api/bransamente/${selected.id}/atr`} target="_blank" className="btn-secondary inline-flex items-center gap-2"><FileText size={16}/> ATR</a>}<a href={`/api/bransamente/${selected.id}/document?type=contract`} className="btn-secondary inline-flex items-center gap-2"><Download size={16}/> Contract + memoriu</a><a href={`/api/bransamente/${selected.id}/document?type=a3`} className="btn-secondary inline-flex items-center gap-2"><Download size={16}/> Dosar A3</a> </>}{canManage && <><button onClick={save} disabled={!!busy} className="btn-primary inline-flex items-center gap-2">{busy === 'save' ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvează</button><button onClick={remove} disabled={!!busy} className="round-action text-rose-500" title="Șterge dosarul"><Trash2 size={17}/></button></>}</div></div>
        {!canManage && <div className="mb-5 flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800"><ShieldCheck size={18}/> Date protejate. Poți consulta datele și stadiul dosarelor. Modificările și documentele sunt rezervate Super Adminului.</div>}
        <div className="space-y-7">{CONNECTION_FIELD_GROUPS.map((group) => <fieldset key={group.title}><div className="mb-3 flex items-center justify-between"><legend className="text-sm font-black uppercase tracking-[.08em] text-[#0d5d8b]">{group.title}</legend>{canManage && <button onClick={() => clearGroup(group.fields)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-rose-500"><X size={13}/> Golește secțiunea</button>}</div><div className={`grid gap-3 ${group.title === 'Adresă' || group.title === 'Puteri' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>{group.fields.map((field) => { const large = field === 'Solutia' || field === 'Amplasament' || field === 'AmplasamentA3'; return <label key={field} className={`text-xs font-bold text-slate-500 ${large ? 'md:col-span-full' : ''}`}>{CONNECTION_FIELD_LABELS[field] || field}{large ? <textarea disabled={!canManage} value={draft[field]} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} className="input-field mt-1.5 min-h-20 w-full resize-y bg-white disabled:bg-slate-50 disabled:text-slate-700"/> : <input disabled={!canManage} value={draft[field]} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} className="input-field mt-1.5 w-full bg-white disabled:bg-slate-50 disabled:text-slate-700"/>}</label>})}</div></fieldset>)}</div>
      </> : <div className="flex min-h-[600px] flex-col items-center justify-center text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf7fc] text-[#197fb5]"><FileText size={30}/></div><h2 className="text-xl font-bold text-[#082b4d]">Niciun dosar selectat</h2><p className="mt-2 max-w-md text-sm text-slate-500">{canManage ? 'Încarcă un ATR sau creează o fișă goală. Datele rămân în istoric și documentele Word se generează oricând.' : 'Nu există încă dosare de branșament disponibile pentru consultare.'}</p></div>}</section>
    </div>
  </div>
}
