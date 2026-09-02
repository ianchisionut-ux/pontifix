'use client'

import { useState } from 'react'
import { ChevronDown, Download, FileText, Search } from 'lucide-react'
import { CONNECTION_FIELD_GROUPS, CONNECTION_FIELD_LABELS, type ConnectionCaseDto } from '@/lib/connection-fields'
import { CONNECTION_STATUS_META } from '@/lib/connection-status'

export function AdminConnectionAccordion({ items, query, onQueryChange }: { items: ConnectionCaseDto[]; query: string; onQueryChange: (value: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return <section className="min-h-[720px] bg-[#f5f9fc] p-4 lg:p-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-bold text-[#082b4d]">Lista branșamentelor</h2><p className="text-xs text-slate-500">{items.length} dosare afișate · apasă săgeata pentru detalii</p></div>
      <label className="flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"><Search size={16} className="text-slate-400"/><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Caută beneficiar, NIB, telefon sau ATR…" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label>
    </div>
    <div className="space-y-3">{items.map((item) => {
      const expanded = expandedId === item.id
      const meta = CONNECTION_STATUS_META[item.status]
      return <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-[#9bcce4]">
        <button type="button" onClick={() => setExpandedId(expanded ? null : item.id)} className="grid w-full items-center gap-3 px-4 py-4 text-left md:grid-cols-[minmax(200px,1.3fr)_minmax(180px,1fr)_minmax(150px,.7fr)_auto] lg:px-5">
          <div className="min-w-0"><p className="text-[11px] font-black text-[#197fb5]">#{item.sequenceNumber} / {item.nib}</p><p className="mt-1 truncate text-base font-black text-[#082b4d]">{item.fields.Beneficiar || 'Beneficiar necompletat'}</p></div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-600">{item.fields.ATR || item.atrName || 'Fișă fără ATR'}</p><p className="mt-1 truncate text-xs text-slate-400">{item.fields.Amplasament || 'Amplasament necompletat'}</p></div>
          <div><p className="text-sm font-semibold text-slate-600">{item.fields.Telefon || 'Telefon necompletat'}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString('ro-RO', { dateStyle: 'medium' })}</p></div>
          <div className="flex items-center justify-end gap-3"><span className="hidden rounded-full px-3 py-1.5 text-xs font-black text-white sm:inline-flex" style={{ backgroundColor: meta.color }}>{meta.label}</span><span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition ${expanded ? 'rotate-180 bg-[#e5f5fb] text-[#0d5d8b]' : ''}`}><ChevronDown size={18}/></span></div>
        </button>
        {expanded && <div className="border-t border-slate-100 bg-[#fbfdfe] px-4 py-5 lg:px-6">
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
            <span className="mr-1 text-xs font-black uppercase tracking-[.08em] text-[#0d5d8b]">Documente dosar</span>
            {item.atrPathname && <a href={`/api/bransamente/${item.id}/atr`} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-2"><FileText size={15}/> ATR</a>}
            <a href={`/api/bransamente/${item.id}/document?type=contract`} className="btn-secondary inline-flex items-center gap-2"><Download size={15}/> Contract + memoriu</a>
            <a href={`/api/bransamente/${item.id}/document?type=a3`} className="btn-secondary inline-flex items-center gap-2"><Download size={15}/> Dosar A3</a>
            {!item.atrPathname && <span className="text-xs font-semibold text-slate-500">ATR neîncărcat</span>}
          </div>
          <div className="mb-5"><div className="flex items-center justify-between text-xs font-bold"><span className="text-slate-500">Stadiu branșament</span><span style={{ color: meta.color }}>{meta.label} · {meta.progress}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full" style={{ width: `${meta.progress}%`, backgroundColor: meta.color }}/></div></div>
          <div className="grid gap-6 xl:grid-cols-2">{CONNECTION_FIELD_GROUPS.map((group) => {
            const fields = group.fields.filter((field) => item.fields[field])
            if (!fields.length) return null
            return <section key={group.title} className="rounded-2xl border border-slate-100 bg-white p-4"><h3 className="mb-3 text-xs font-black uppercase tracking-[.08em] text-[#0d5d8b]">{group.title}</h3><dl className="grid gap-3 sm:grid-cols-2">{fields.map((field) => <div key={field} className={field === 'Solutia' || field === 'Amplasament' || field === 'AmplasamentA3' ? 'sm:col-span-2' : ''}><dt className="text-[11px] font-bold text-slate-400">{CONNECTION_FIELD_LABELS[field] || field}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-700">{item.fields[field]}</dd></div>)}</dl></section>
})}</div>
        </div>}
      </article>
    })}{!items.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Nu există branșamente pentru căutarea curentă.</div>}</div>
  </section>
}
