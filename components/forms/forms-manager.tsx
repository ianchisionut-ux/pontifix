'use client'

import { useState } from 'react'
import { uploadPresigned } from '@vercel/blob/client'
import { useRouter } from 'next/navigation'
import { Edit3, FilePlus2, FileText, History, Loader2, Plus, Printer, RefreshCw, Trash2, X } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import type { FormSubmissionDto, FormTemplateDto } from '@/lib/ensure-form-storage'
import { PdfRequestEditor, type ConnectionFormOption, type ProjectFormOption } from './pdf-request-editor'

type Category = 'FORMULAR' | 'CERERE'

export function FormsManager({ initialForms, initialSubmissions, connections, projects, canManage, canEdit }: {
  initialForms: FormTemplateDto[]
  initialSubmissions: FormSubmissionDto[]
  connections: ConnectionFormOption[]
  projects: ProjectFormOption[]
  canManage: boolean
  canEdit: boolean
}) {
  const { tr } = useLanguage()
  const router = useRouter()
  const [category, setCategory] = useState<Category>('FORMULAR')
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState('')
  const [editor, setEditor] = useState<{ template: FormTemplateDto; submission?: FormSubmissionDto } | null>(null)
  const items = initialForms.filter((item) => item.category === category)
  const requests = initialForms.filter((item) => item.category === 'CERERE')

  async function uploadPdf(pdf: File, pathname: string) {
    if (pdf.type !== 'application/pdf') throw new Error(tr('Fișierul trebuie să fie PDF.'))
    if (pdf.size > 20 * 1024 * 1024) throw new Error(tr('PDF-ul poate avea maximum 20 MB.'))
    return uploadPresigned(pathname, pdf, { access: 'private', handleUploadUrl: '/api/formulare/upload' })
  }

  async function addForm() {
    if (!title.trim() || !file) return
    setBusy('add')
    try {
      const blob = await uploadPdf(file, `formulare/${category.toLowerCase()}/${file.name}`)
      const response = await fetch('/api/formulare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, category, documentPathname: blob.pathname, documentName: file.name }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || tr('Formularul nu a putut fi adăugat.'))
      setModalOpen(false); setTitle(''); setFile(null); router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : tr('Formularul nu a putut fi adăugat.')) }
    finally { setBusy('') }
  }

  async function replaceForm(item: FormTemplateDto, replacement?: File) {
    if (!replacement) return
    setBusy(item.id)
    try {
      const blob = await uploadPdf(replacement, `formulare/${item.id.replace(/[^a-zA-Z0-9_-]/g, '-')}/${Date.now()}-${replacement.name}`)
      const response = await fetch(`/api/formulare/${encodeURIComponent(item.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentPathname: blob.pathname, documentName: replacement.name }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || tr('Formularul nu a putut fi înlocuit.'))
      router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : tr('Formularul nu a putut fi înlocuit.')) }
    finally { setBusy('') }
  }

  function printForm(item: FormTemplateDto) {
    const url = `/api/formulare/${encodeURIComponent(item.id)}/document`
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0'
    frame.src = url
    frame.onload = () => { try { frame.contentWindow?.focus(); frame.contentWindow?.print() } catch { window.open(url, '_blank', 'noopener,noreferrer') }; setTimeout(() => frame.remove(), 4000) }
    document.body.appendChild(frame)
  }

  async function removeSubmission(id: string) {
    if (!confirm('Ștergi această completare salvată?')) return
    const response = await fetch(`/api/formulare/submissions/${id}`, { method: 'DELETE' })
    if (!response.ok) return alert('Completarea nu a putut fi ștearsă.')
    router.refresh()
  }

  return <div>
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#197fb5]">{tr('Documente tipizate')}</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#082b4d]">{tr('Formulare și cereri')}</h1><p className="mt-1 text-sm text-slate-500">{tr('Previzualizare, completare directă pe PDF, salvare și printare.')}</p></div>
      {canManage && <button className="btn-primary inline-flex items-center gap-2" onClick={() => { setBusy(''); setModalOpen(true) }}><Plus size={17}/> {category === 'FORMULAR' ? tr('Adaugă formular') : tr('Adaugă model de cerere')}</button>}
    </header>
    <div className="mb-5 inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      <button onClick={() => setCategory('FORMULAR')} className={`rounded-xl px-5 py-2.5 text-sm font-bold ${category === 'FORMULAR' ? 'bg-[#0d5d8b] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{tr('Formulare')} <span className="ml-1 opacity-70">{initialForms.filter((item) => item.category === 'FORMULAR').length}</span></button>
      <button onClick={() => setCategory('CERERE')} className={`rounded-xl px-5 py-2.5 text-sm font-bold ${category === 'CERERE' ? 'bg-[#0d5d8b] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{tr('Cereri')} <span className="ml-1 opacity-70">{requests.length}</span></button>
    </div>

    {category === 'FORMULAR' ? <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5"><div className="min-w-0"><h2 className="line-clamp-2 text-sm font-extrabold leading-5 text-[#082b4d]">{item.title}</h2><p className="mt-1 truncate text-[11px] text-slate-400">{item.documentName}</p></div><button onClick={() => printForm(item)} className="btn-secondary inline-flex shrink-0 items-center gap-2 !px-3 !py-2 text-xs"><Printer size={15}/> {tr('Printează')}</button></div>
      <div className="relative h-[440px] bg-slate-100"><iframe title={item.title} src={`/api/formulare/${encodeURIComponent(item.id)}/document#toolbar=0&navpanes=0&view=FitH`} loading="lazy" className="h-full w-full bg-white"/></div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3"><a href={`/api/formulare/${encodeURIComponent(item.id)}/document`} target="_blank" className="inline-flex items-center gap-2 text-xs font-bold text-[#0d5d8b]"><FileText size={15}/> {tr('Deschide PDF')}</a>{canManage && <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 !px-3 !py-2 text-xs">{busy === item.id ? <Loader2 size={15} className="animate-spin"/> : <RefreshCw size={15}/>} {tr('Înlocuiește')}<input type="file" accept="application/pdf,.pdf" className="hidden" disabled={!!busy} onChange={(event) => replaceForm(item, event.target.files?.[0])}/></label>}</div>
    </article>)}</div> : <div className="space-y-6">
      <section><div className="mb-3 flex items-center gap-2"><FilePlus2 size={18} className="text-[#197fb5]"/><h2 className="font-bold text-[#082b4d]">{tr('Modele de cereri')}</h2></div><div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{requests.map((item) => <article key={item.id} className="flex min-h-[150px] flex-col rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf7fc] text-[#197fb5]"><FileText size={20}/></div><div className="min-w-0"><h3 className="font-extrabold text-[#082b4d]">{item.title}</h3><p className="mt-1 text-xs text-slate-400">{item.fieldSchema.length} {tr('câmpuri configurate')}</p></div></div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">{canEdit&&<button className="btn-primary inline-flex items-center gap-2 !px-4 !py-2 text-sm" onClick={() => setEditor({ template: item })}><Edit3 size={16}/> {tr('Completează pe PDF')}</button>}<a className="btn-secondary !px-3 !py-2 text-xs" href={`/api/formulare/${encodeURIComponent(item.id)}/document`} target="_blank">{tr('PDF gol')}</a>{canManage && <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 !px-3 !py-2 text-xs"><RefreshCw size={14}/> {tr('Înlocuiește')}<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => replaceForm(item, event.target.files?.[0])}/></label>}</div>
      </article>)}</div></section>
      <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><History size={18} className="text-[#197fb5]"/><h2 className="font-bold text-[#082b4d]">{tr('Completări salvate')}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{initialSubmissions.length}</span></div>
        {initialSubmissions.length ? <div className="divide-y divide-slate-100">{initialSubmissions.map((saved) => { const template = requests.find((item) => item.id === saved.formTemplateId); return <div key={saved.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-[240px] flex-1"><b className="block text-sm text-[#082b4d]">{saved.title}</b><span className="text-xs text-slate-400">{template?.title} · {new Date(saved.updatedAt).toLocaleString('ro-RO')}</span></div>{canEdit&&template && <button className="btn-secondary inline-flex items-center gap-2 !px-3 !py-2 text-xs" onClick={() => setEditor({ template, submission: saved })}><Edit3 size={14}/> {tr('Redeschide')}</button>}{canEdit&&<button className="round-action !text-red-600" onClick={() => removeSubmission(saved.id)}><Trash2 size={15}/></button>}</div> })}</div> : <p className="py-8 text-center text-sm text-slate-400">{tr('Nu există încă cereri completate și salvate.')}</p>}
      </section>
    </div>}

    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={() => !busy && setModalOpen(false)}><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold text-[#082b4d]">{category === 'FORMULAR' ? tr('Adaugă formular') : tr('Adaugă model de cerere')}</h2><p className="mt-1 text-sm text-slate-500">{tr('Încarcă PDF-ul gol, care va rămâne fundalul documentului.')}</p></div><button className="round-action" onClick={() => setModalOpen(false)}><X size={17}/></button></div><label className="mt-5 block text-sm font-bold text-slate-600">{tr('Denumirea documentului')}<input className="input-field mt-1.5 w-full" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180}/></label><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[#8bc8e5] bg-[#f4fbfe] p-5"><FileText className="text-[#197fb5]"/><span className="min-w-0 flex-1"><b className="block text-sm text-[#082b4d]">{file?.name || tr('Selectează documentul PDF')}</b><small className="text-slate-500">{tr('Maximum 20 MB')}</small></span><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)}/></label><div className="mt-6 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setModalOpen(false)}>{tr('Renunță')}</button><button className="btn-primary inline-flex items-center gap-2" disabled={!title.trim() || !file || busy === 'add'} onClick={addForm}>{busy === 'add' ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>} {tr('Adaugă')}</button></div></div></div>}
    {canEdit&&editor && <PdfRequestEditor template={editor.template} initialSubmission={editor.submission} connections={connections} projects={projects} canManage={canManage} onClose={() => { setEditor(null); router.refresh() }}/>}
  </div>
}