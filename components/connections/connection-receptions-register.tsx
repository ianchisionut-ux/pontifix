'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, ClipboardCheck, FileSpreadsheet, Pencil, Plus, Printer, Search, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ConnectionReceptionDto } from '@/lib/connection-reception-storage'

export function ConnectionReceptionsRegister({ initialRecords, canManage }: { initialRecords: ConnectionReceptionDto[]; canManage: boolean }) {
  const router = useRouter()
  const [records, setRecords] = useState(initialRecords)
  const [year, setYear] = useState<number | 'ALL'>(() => initialRecords.some((item) => item.year === new Date().getFullYear()) ? new Date().getFullYear() : 'ALL')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<ConnectionReceptionDto | 'new' | null>(null)
  const [busy, setBusy] = useState('')
  const importInput = useRef<HTMLInputElement>(null)

  useEffect(() => setRecords(initialRecords), [initialRecords])
  const years = useMemo(() => [...new Set(records.map((item) => item.year))].sort((a, b) => b - a), [records])
  const visible = useMemo(() => records.filter((item) => {
    if (year !== 'ALL' && item.year !== year) return false
    const text = `${item.orderNumber} ${item.workType} ${item.beneficiary} ${item.location} ${item.lot} ${item.approvalNumber} ${item.expirationDate}`.toLocaleLowerCase('ro-RO')
    return text.includes(query.trim().toLocaleLowerCase('ro-RO'))
  }), [records, query, year])

  async function api(url: string, method: string, data?: unknown) {
    const response = await fetch(url, { method, headers: data ? { 'Content-Type': 'application/json' } : undefined, body: data ? JSON.stringify(data) : undefined })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'Operațiunea nu a putut fi salvată.')
    return body
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage || !modal) return
    const form = new FormData(event.currentTarget)
    const payload = {
      year: Number(form.get('year')),
      orderNumber: Number(form.get('orderNumber')) || undefined,
      workType: String(form.get('workType') || ''),
      beneficiary: String(form.get('beneficiary') || ''),
      location: String(form.get('location') || ''),
      lot: String(form.get('lot') || ''),
      approvalNumber: String(form.get('approvalNumber') || ''),
      expirationDate: String(form.get('expirationDate') || ''),
      received: form.get('received') === 'on',
      notes: String(form.get('notes') || ''),
    }
    setBusy('save')
    try {
      if (modal === 'new') await api('/api/bransamente/receptii', 'POST', payload)
      else await api(`/api/bransamente/receptii/${modal.id}`, 'PATCH', payload)
      setModal(null)
      router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : 'Recepția nu a putut fi salvată.') }
    finally { setBusy('') }
  }

  async function toggleReceived(item: ConnectionReceptionDto) {
    if (!canManage) return
    setBusy(`received-${item.id}`)
    try {
      await api(`/api/bransamente/receptii/${item.id}`, 'PATCH', { received: !item.received })
      setRecords((current) => current.map((record) => record.id === item.id ? { ...record, received: !record.received, receivedAt: !record.received ? new Date().toISOString() : null } : record))
      router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : 'Starea recepției nu a putut fi schimbată.') }
    finally { setBusy('') }
  }

  async function remove(item: ConnectionReceptionDto) {
    if (!canManage || !confirm(`Ștergi poziția ${item.orderNumber}/${item.year} din registrul de recepții?`)) return
    setBusy(`delete-${item.id}`)
    try {
      await api(`/api/bransamente/receptii/${item.id}`, 'DELETE')
      setRecords((current) => current.filter((record) => record.id !== item.id))
      router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : 'Recepția nu a putut fi ștearsă.') }
    finally { setBusy('') }
  }


  async function importExcel(file?: File) {
    if (!file || !canManage) return
    if (!confirm(`Import registrul din ${file.name}? Pozițiile importate anterior din Excel vor fi actualizate.`)) return
    setBusy('import')
    try {
      const form = new FormData()
      form.set('file', file)
      const response = await fetch('/api/bransamente/receptii/import', { method: 'POST', body: form })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Registrul nu a putut fi importat.')
      alert(`${body.imported} poziții au fost importate.`)
      router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : 'Registrul nu a putut fi importat.') }
    finally { setBusy(''); if (importInput.current) importInput.current.value = '' }
  }

  const yearRecords = year === 'ALL' ? records : records.filter((item) => item.year === year)
  const selectedYear = year === 'ALL' ? new Date().getFullYear() : year

  return <div>
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><span className="text-xs font-black uppercase tracking-[.16em] text-[#197fb5]">Registru tehnic</span><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#082b4d]">Recepții</h1><p className="mt-1 text-sm text-slate-500">Istoricul avizelor și urmărirea recepției lucrărilor, separat de dosarele branșamentelor.</p></div>
      <div className="screen-only flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} className="btn-secondary inline-flex items-center gap-2"><Printer size={17}/> Printează</button>{canManage&&<><input ref={importInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => importExcel(event.target.files?.[0])}/><button type="button" disabled={busy==='import'} onClick={() => importInput.current?.click()} className="btn-secondary inline-flex items-center gap-2"><FileSpreadsheet size={17}/> {busy==='import'?'Se importă…':'Importă Excel'}</button><button type="button" onClick={() => setModal('new')} className="btn-primary inline-flex items-center gap-2"><Plus size={17}/> Adaugă recepție</button></>}</div>
    </header>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Poziții în registru" value={records.length}/><Stat label={year === 'ALL' ? 'Poziții afișate' : `Poziții ${year}`} value={yearRecords.length}/><Stat label="Recepționate" value={yearRecords.filter((item) => item.received).length} green/><Stat label="În așteptare" value={yearRecords.filter((item) => !item.received).length}/>
    </div>

    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="screen-only flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
        <label className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"><Search size={16} className="text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută beneficiar, amplasament, aviz…" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label>
        <button type="button" onClick={() => setYear('ALL')} className={year === 'ALL' ? 'btn-primary' : 'btn-secondary'}>Toți anii</button>{years.map((item) => <button type="button" key={item} onClick={() => setYear(item)} className={year === item ? 'btn-primary' : 'btn-secondary'}>{item}</button>)}
      </div>
      <div className="print-only border-b border-slate-300 p-4"><h2 className="text-lg font-black">REGISTRU RECEPȚII {year === 'ALL' ? '– TOȚI ANII' : `– ${year}`}</h2><p className="text-xs text-slate-500">ELMONT S.A. · generat la {new Date().toLocaleDateString('ro-RO')}</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1180px] border-collapse text-left text-sm"><thead className="bg-[#dfe8ef] text-[11px] uppercase tracking-wide text-[#082b4d]"><tr><th className="px-3 py-3">Nr. crt.</th><th className="px-3 py-3">An</th><th className="px-3 py-3">Tip lucrare</th><th className="px-3 py-3">Beneficiar</th><th className="px-3 py-3">Amplasament</th><th className="px-3 py-3 text-center">Lot</th><th className="px-3 py-3 text-center">Nr. aviz</th><th className="px-3 py-3 text-center">Data exp.</th><th className="px-3 py-3 text-center">Recepționat</th>{canManage&&<th className="screen-only px-3 py-3 text-right">Acțiuni</th>}</tr></thead><tbody>{visible.map((item) => <tr key={item.id} className="border-t border-slate-100 text-slate-700 hover:bg-slate-50/70"><td className="px-3 py-3 font-black text-[#197fb5]">{item.orderNumber}</td><td className="px-3 py-3 font-bold">{item.year}</td><td className="max-w-[220px] px-3 py-3 font-semibold">{item.workType||'—'}</td><td className="max-w-[220px] px-3 py-3 font-bold text-[#082b4d]">{item.beneficiary||'—'}</td><td className="max-w-[300px] px-3 py-3">{item.location||'—'}</td><td className="px-3 py-3 text-center">{item.lot||'—'}</td><td className="px-3 py-3 text-center font-bold">{item.approvalNumber||'—'}</td><td className="whitespace-nowrap px-3 py-3 text-center">{item.expirationDate||'—'}</td><td className="px-3 py-3 text-center"><button type="button" disabled={!canManage||busy===`received-${item.id}`} onClick={() => toggleReceived(item)} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${item.received?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-800'} ${canManage?'cursor-pointer':'cursor-default'}`}>{item.received?<><CheckCircle2 size={13}/> Da</>:'În așteptare'}</button></td>{canManage&&<td className="screen-only px-3 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => setModal(item)} className="round-action !h-8 !w-8" title="Editează"><Pencil size={14}/></button><button type="button" onClick={() => remove(item)} disabled={busy===`delete-${item.id}`} className="round-action !h-8 !w-8 text-rose-600" title="Șterge"><Trash2 size={14}/></button></div></td>}</tr>)}{!visible.length&&<tr><td colSpan={canManage?10:9} className="px-5 py-14 text-center text-slate-500">Nu există recepții pentru filtrul selectat.</td></tr>}</tbody></table></div>
      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">{visible.length} poziții afișate · istoricul inițial provine din Receptii.xlsx</div>
    </section>

    {modal&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={() => setModal(null)}><form onSubmit={save} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[26px] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-black uppercase tracking-[.14em] text-[#197fb5]">Registru recepții</span><h2 className="mt-1 text-2xl font-bold text-[#082b4d]">{modal==='new'?'Adaugă poziție':'Editează poziția'}</h2></div><button type="button" onClick={() => setModal(null)} className="round-action"><X size={18}/></button></div><div className="mt-5 grid gap-3 md:grid-cols-2"><Field label="An" name="year" type="number" value={modal==='new'?selectedYear:modal.year} required/><Field label="Nr. crt. (gol = automat)" name="orderNumber" type="number" value={modal==='new'?'':modal.orderNumber}/><Field span label="Tip lucrare" name="workType" value={modal==='new'?'':modal.workType}/><Field label="Beneficiar" name="beneficiary" value={modal==='new'?'':modal.beneficiary}/><Field label="Lot" name="lot" value={modal==='new'?'':modal.lot}/><Field span label="Amplasament" name="location" value={modal==='new'?'':modal.location}/><Field label="Nr. aviz" name="approvalNumber" value={modal==='new'?'':modal.approvalNumber}/><Field label="Data expirării" name="expirationDate" value={modal==='new'?'':modal.expirationDate} placeholder="ZZ.LL.AAAA"/><label className="md:col-span-2 text-xs font-bold text-slate-500">Observații<textarea name="notes" defaultValue={modal==='new'?'':modal.notes} className="input-field mt-1.5 min-h-20 w-full resize-y bg-white"/></label><label className="md:col-span-2 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><input type="checkbox" name="received" defaultChecked={modal!=='new'&&modal.received} className="h-4 w-4"/> Lucrarea este recepționată</label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Renunță</button><button disabled={busy==='save'} className="btn-primary">{busy==='save'?'Se salvează…':'Salvează'}</button></div></form></div>}
  </div>
}

function Stat({ label, value, green=false }: { label: string; value: number; green?: boolean }) { return <div className="card flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${green?'bg-emerald-50 text-emerald-600':'bg-[#edf7fc] text-[#197fb5]'}`}><ClipboardCheck size={20}/></div><div><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-[#082b4d]">{value}</p></div></div> }
function Field({ label, name, value, type='text', span=false, required=false, placeholder='' }: { label:string; name:string; value:string|number; type?:string; span?:boolean; required?:boolean; placeholder?:string }) { return <label className={`${span?'md:col-span-2 ':''}text-xs font-bold text-slate-500`}>{label}<input name={name} type={type} defaultValue={value} required={required} placeholder={placeholder} className="input-field mt-1.5 w-full bg-white"/></label> }