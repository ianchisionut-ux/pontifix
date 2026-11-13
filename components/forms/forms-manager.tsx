'use client'

import { useEffect, useState } from 'react'
import { uploadPresigned } from '@vercel/blob/client'
import { useRouter } from 'next/navigation'
import { Edit3, FilePlus2, FileText, History, Loader2, PenLine, Plus, Printer, RefreshCw, Stamp, Trash2, X } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import type { FormSubmissionDto, FormTemplateDto } from '@/lib/ensure-form-storage'
import { PdfRequestEditor, type ConnectionFormOption, type ProjectFormOption } from './pdf-request-editor'
import { PdfStampEditor } from './pdf-stamp-editor'
import { DeerBulkPreview } from './deer-bulk-preview'
import { BeneficiarySignatureCapture } from './beneficiary-signature-capture'
import { DeerSigningManager } from './deer-signing-manager'
import { beneficiarySigned } from './form-stamps'
import { IdentityCardScanner } from '@/components/identity-cards/identity-card-scanner'
import type { IdentityCardRecord } from '@/lib/identity-card-storage'
import { DEER_DOCUMENT_KINDS, DEER_DOCUMENT_LABELS, deerDocumentKindForTemplate, type DeerBorderouDto, type DeerDocumentKind } from '@/lib/deer-borderou-shared'

type Category = 'FORMULAR' | 'CERERE' | 'DEER' | 'SEMNARE' | 'CI'

export function FormsManager({ initialForms, initialSubmissions, connections, projects, identityCards, borderouri, canManage, canEdit }: {
  initialForms: FormTemplateDto[]
  initialSubmissions: FormSubmissionDto[]
  connections: ConnectionFormOption[]
  projects: ProjectFormOption[]
  identityCards: IdentityCardRecord[]
  borderouri: DeerBorderouDto[]
  canManage: boolean
  canEdit: boolean
}) {
  const { tr } = useLanguage()
  const router = useRouter()
  const [category, setCategory] = useState<Category>('FORMULAR')
  const [deerConnectionId, setDeerConnectionId] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') !== 'DEER') return
    setCategory('DEER')
    const caseId = params.get('case')
    if (caseId && connections.some((connection) => connection.id === caseId)) setDeerConnectionId(caseId)
  }, [connections])
  const [deerBulkOpen, setDeerBulkOpen] = useState(false)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [signingLinkOpen, setSigningLinkOpen] = useState(false)
  const [signatureVersion, setSignatureVersion] = useState(0)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [renamingId, setRenamingId] = useState('')
  const [renamedTitle, setRenamedTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState('')
  const [editor, setEditor] = useState<{ template: FormTemplateDto; submission?: FormSubmissionDto } | null>(null)
  const [stampEditor, setStampEditor] = useState<FormTemplateDto | null>(null)
  const items = initialForms.filter((item) => item.category === category)
  const requests = initialForms.filter((item) => item.category === 'CERERE')
  const editableTemplates = category === 'DEER' ? items : requests
  const savedSubmissions = initialSubmissions.filter((saved) => editableTemplates.some((item) => item.id === saved.formTemplateId) && (category !== 'DEER' || (!!deerConnectionId && saved.sourceId === deerConnectionId)))
  const selectedDeerConnection = connections.find((connection) => connection.id === deerConnectionId)
  const caseDocument = (kind: DeerDocumentKind) => borderouri.find((document) => document.connectionId === deerConnectionId && document.documentKind === kind)
  const pendingBorderouri = borderouri.filter((document) => !document.connectionId)
  const newDeerDocuments = borderouri.filter((document) => document.source === 'EMAIL' && document.notificationStatus !== 'READ')
  const bulkTemplates = items.filter((item) => { const kind = deerDocumentKindForTemplate(item); return !kind || !!caseDocument(kind) })
  const submissionFor = (templateId: string) => selectedDeerConnection
    ? initialSubmissions.find((saved) => saved.formTemplateId === templateId && saved.sourceId === selectedDeerConnection.id)
    : undefined

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

  async function renameForm(item: FormTemplateDto) {
    if (!renamedTitle.trim() || renamedTitle.trim() === item.title) { setRenamingId(''); return }
    setBusy(`rename:${item.id}`)
    try {
      const response = await fetch(`/api/formulare/${encodeURIComponent(item.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: renamedTitle.trim() }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Numele șablonului nu a putut fi schimbat.')
      setRenamingId(''); router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : 'Redenumirea a eșuat.') }
    finally { setBusy('') }
  }

  async function uploadBorderou(kind: DeerDocumentKind, pdf?: File) {
    if (!pdf || !selectedDeerConnection) return
    setBusy(`upload:${kind}`)
    try {
      if (pdf.size > 4 * 1024 * 1024) throw new Error('PDF-ul poate avea maximum 4 MB.')
      const form = new FormData()
      form.append('connectionId', selectedDeerConnection.id)
      form.append('documentKind', kind)
      form.append('file', pdf)
      const response = await fetch('/api/formulare/borderou', { method: 'POST', body: form })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Borderoul nu a putut fi salvat.')
      router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : 'Încărcarea borderoului a eșuat.') }
    finally { setBusy('') }
  }

  async function syncBorderouri() {
    setBusy('borderou-sync')
    try {
      const response = await fetch('/api/formulare/borderou/sync', { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'E-mailul DEER nu poate fi verificat.')
      const details = (body.newDocuments || []).map((document: { documentKind: DeerDocumentKind; documentName: string; beneficiary: string; dossierNumber: string; connectionId: string | null }) => {
        const connection = connections.find((item) => item.id === document.connectionId)
        return `${DEER_DOCUMENT_LABELS[document.documentKind]} — ${document.documentName}\n  ${connection ? `${connection.fields.Beneficiar || document.beneficiary} · ${connection.nib}` : `${document.beneficiary || document.dossierNumber || 'Dosar neidentificat'} · necesită asociere manuală`}`
      }).join('\n')
      alert(`Verificate ${body.scanned || 0} e-mailuri DEER. Documente noi: ${body.imported || 0}; asociate: ${body.matched || 0}; corectate: ${body.corrected || 0}; de verificat: ${body.pending || 0}.${details ? `\n\n${details}` : ''}`)
      router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : 'E-mailul DEER nu poate fi verificat.') }
    finally { setBusy('') }
  }

  async function markDeerSeen(id: string) {
    setBusy(`seen:${id}`)
    try {
      const response = await fetch('/api/formulare/borderou/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!response.ok) throw new Error('Documentul nu a putut fi marcat ca văzut.')
      router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : 'Actualizarea a eșuat.') }
    finally { setBusy('') }
  }

  async function assignBorderou(id: string, connectionId: string) {
    if (!connectionId) return
    setBusy(`assign:${id}`)
    try {
      const response = await fetch('/api/formulare/borderou', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, connectionId }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Asocierea a eșuat.')
      router.refresh()
    } catch (error) { alert(error instanceof Error ? error.message : 'Asocierea a eșuat.') }
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
      {canManage && category !== 'CI' && <button className="btn-primary inline-flex items-center gap-2" onClick={() => { setBusy(''); setModalOpen(true) }}><Plus size={17}/> {category === 'FORMULAR' ? tr('Adaugă formular') : category === 'SEMNARE' ? tr('Adaugă șablon de semnare') : category === 'DEER' ? 'Adaugă șablon DEER' : tr('Adaugă model de cerere')}</button>}
    </header>
    <div className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      <button onClick={() => setCategory('FORMULAR')} className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold ${category === 'FORMULAR' ? 'bg-[#0d5d8b] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{tr('Formulare')} <span className="ml-1 opacity-70">{initialForms.filter((item) => item.category === 'FORMULAR').length}</span></button>
      <button onClick={() => setCategory('CERERE')} className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold ${category === 'CERERE' ? 'bg-[#0d5d8b] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{tr('Cereri')} <span className="ml-1 opacity-70">{requests.length}</span></button>
      <button onClick={() => setCategory('DEER')} className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold ${category === 'DEER' ? 'bg-[#0d5d8b] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>DEER <span className="ml-1 opacity-70">{initialForms.filter((item) => item.category === 'DEER').length}</span></button>
      <button onClick={() => setCategory('SEMNARE')} className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold ${category === 'SEMNARE' ? 'bg-[#0d5d8b] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{tr('Semnare documente')} <span className="ml-1 opacity-70">{initialForms.filter((item) => item.category === 'SEMNARE').length}</span></button><button onClick={() => setCategory('CI')} className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold ${category === 'CI' ? 'bg-[#0d5d8b] text-white' : 'text-slate-500 hover:bg-slate-50'}`}>CI <span className="ml-1 opacity-70">{identityCards.length}</span></button>
    </div>

    {category === 'CI' ? <IdentityCardScanner records={identityCards} connections={connections.map((item) => ({ id: item.id, nib: item.nib, beneficiary: item.fields.Beneficiar || '' }))} canEdit={canEdit}/> : category === 'SEMNARE' ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{items.map((item) => <article key={item.id} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf7fc] text-[#197fb5]"><Stamp size={21}/></div><div className="min-w-0 flex-1"><h3 className="truncate font-extrabold text-[#082b4d]">{item.title}</h3><p className="mt-1 truncate text-xs text-slate-400">{item.documentName}</p><p className="mt-1 text-xs font-semibold text-[#197fb5]">{item.stampSchema.length} elemente poziționate</p></div></div><div className="mt-5 flex flex-wrap gap-2"><button className="btn-primary inline-flex items-center gap-2 !px-4 !py-2 text-sm" onClick={() => setStampEditor(item)}><Edit3 size={16}/> {canManage ? tr('Deschide editorul') : tr('Vizualizează')}</button><a className="btn-secondary !px-3 !py-2 text-xs" href={`/api/formulare/${encodeURIComponent(item.id)}/document`} target="_blank">{tr('PDF original')}</a></div></article>)}</div> : category === 'FORMULAR' ? <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5"><div className="min-w-0"><h2 className="line-clamp-2 text-sm font-extrabold leading-5 text-[#082b4d]">{item.title}</h2><p className="mt-1 truncate text-[11px] text-slate-400">{item.documentName}</p></div><button onClick={() => printForm(item)} className="btn-secondary inline-flex shrink-0 items-center gap-2 !px-3 !py-2 text-xs"><Printer size={15}/> {tr('Printează')}</button></div>
      <div className="relative h-[440px] bg-slate-100">{previewId === item.id ? <iframe title={item.title} src={`/api/formulare/${encodeURIComponent(item.id)}/document#toolbar=0&navpanes=0&view=FitH`} className="h-full w-full bg-white"/> : <button type="button" onClick={() => setPreviewId(item.id)} className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm font-bold text-[#0d5d8b] hover:bg-slate-200/70"><FileText size={30}/>Previzualizează PDF</button>}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3"><a href={`/api/formulare/${encodeURIComponent(item.id)}/document`} target="_blank" className="inline-flex items-center gap-2 text-xs font-bold text-[#0d5d8b]"><FileText size={15}/> {tr('Deschide PDF')}</a>{canManage && <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 !px-3 !py-2 text-xs">{busy === item.id ? <Loader2 size={15} className="animate-spin"/> : <RefreshCw size={15}/>} {tr('Înlocuiește')}<input type="file" accept="application/pdf,.pdf" className="hidden" disabled={!!busy} onChange={(event) => replaceForm(item, event.target.files?.[0])}/></label>}</div>
    </article>)}</div> : <div className="space-y-6">
      {category === 'DEER' && <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:px-5">
        <p className="text-sm text-[#0d5d8b]">Alege branșamentul, înregistrează semnătura cu acordul beneficiarului și poziționeaz-o pe fiecare șablon PDF unde trebuie să semneze. Pozițiile rămân în șablon.</p>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex w-full min-w-0 flex-col gap-2 text-sm font-bold text-[#0d5d8b] sm:w-auto sm:flex-row sm:items-center">Beneficiar / branșament
            <select className="input-field !w-full min-w-0 max-w-full bg-white sm:!w-auto sm:min-w-[220px]" value={deerConnectionId} onChange={(event) => setDeerConnectionId(event.target.value)}><option value="">Alege branșamentul</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.fields.Beneficiar || 'Fără beneficiar'} · {connection.nib}</option>)}</select>
          </label>
          {canEdit && <button type="button" className="btn-secondary inline-flex w-full items-center justify-center gap-2 !py-2 text-sm sm:w-auto" disabled={!selectedDeerConnection} onClick={() => setSignatureOpen(true)}><PenLine size={16}/> Semnătura beneficiarului</button>}
          {canManage && <button type="button" className="btn-secondary inline-flex w-full items-center justify-center gap-2 !py-2 text-sm sm:w-auto" disabled={!selectedDeerConnection} onClick={() => setSigningLinkOpen(true)}><FileText size={16}/> Link de semnare</button>}
          <button type="button" className="btn-primary inline-flex w-full items-center justify-center gap-2 !py-2 text-sm sm:w-auto" disabled={!selectedDeerConnection || !items.length} onClick={() => setDeerBulkOpen(true)}><FileText size={16}/> Previzualizează toate</button>
        </div>
      </div>}
      {category === 'DEER' && <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><b className="text-[#082b4d]">Documentele branșamentului</b><p className="text-slate-500">{selectedDeerConnection ? `${selectedDeerConnection.fields.Beneficiar || 'Beneficiar'} · ${selectedDeerConnection.nib}` : 'Alege un branșament pentru a vedea documentele lui.'}</p></div>{canManage && <button type="button" className="btn-secondary inline-flex items-center gap-2 !py-2" disabled={!!busy} onClick={syncBorderouri}>{busy === 'borderou-sync' ? <Loader2 size={15} className="animate-spin"/> : <RefreshCw size={15}/>} Verifică e-mailul DEER</button>}</div>
        {canManage && newDeerDocuments.length > 0 && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3"><b className="text-[#082b4d]">Documente DEER noi ({newDeerDocuments.length})</b><p className="mt-1 text-xs text-slate-600">Verifică documentul și dosarul asociat. Cele fără potrivire așteaptă asociere manuală mai jos.</p><div className="mt-3 space-y-2">{newDeerDocuments.map((document) => { const connection = connections.find((item) => item.id === document.connectionId); return <div key={document.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-3"><span className="min-w-[200px] flex-1"><b className="block text-[#082b4d]">{DEER_DOCUMENT_LABELS[document.documentKind]} · {document.documentName}</b><span className="block text-xs text-slate-600">{connection ? `${connection.fields.Beneficiar || document.beneficiary || 'Beneficiar'} · ${connection.nib}` : `${document.beneficiary || 'Beneficiar neidentificat'} · ${document.dossierNumber || 'fără număr dosar'} · necesită asociere manuală`} · {new Date(document.receivedAt).toLocaleString('ro-RO')}</span></span><a className="btn-secondary !px-3 !py-1 text-xs" href={`/api/formulare/borderou/${document.id}/document`} target="_blank" rel="noopener noreferrer">Vezi PDF</a>{connection && <button type="button" className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setDeerConnectionId(connection.id)}>Deschide dosarul</button>}<button type="button" className="btn-secondary !px-3 !py-1 text-xs" disabled={!!busy} onClick={() => markDeerSeen(document.id)}>Am văzut</button></div> })}</div></div>}
        {selectedDeerConnection && <div className="mt-3 space-y-2"><div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3"><FileText size={18} className="text-[#197fb5]"/><span className="min-w-0 flex-1"><b className="block text-[#082b4d]">Contract + notificare</b><small className="text-slate-500">PDF generat din dosarul acestui branșament</small></span><a className="btn-secondary !px-3 !py-2 text-xs" href={`/api/bransamente/${encodeURIComponent(selectedDeerConnection.id)}/document?type=contract&format=pdf`} target="_blank" rel="noopener noreferrer">Vezi PDF</a></div>{DEER_DOCUMENT_KINDS.map((kind) => { const document = caseDocument(kind); return <div key={kind} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3"><FileText size={18} className="text-[#197fb5]"/><span className="min-w-0 flex-1"><b className="block text-[#082b4d]">{DEER_DOCUMENT_LABELS[kind]}</b><small className="text-slate-500">{document ? `${document.documentName} · ${new Date(document.receivedAt).toLocaleString('ro-RO')}` : 'Nu există document asociat acestui branșament.'}</small></span>{document && <a className="btn-secondary !px-3 !py-2 text-xs" href={`/api/formulare/borderou/${document.id}/document`} target="_blank" rel="noopener noreferrer">Vezi PDF</a>}{canManage && <label className="btn-secondary cursor-pointer !px-3 !py-2 text-xs">{busy === `upload:${kind}` ? 'Se încarcă…' : document ? 'Înlocuiește pentru acest branșament' : 'Încarcă PDF'}<input className="hidden" type="file" accept="application/pdf,.pdf" disabled={!!busy} onChange={(event) => { uploadBorderou(kind, event.target.files?.[0]); event.currentTarget.value = '' }}/></label>}</div> })}</div>}
        {selectedDeerConnection && borderouri.some((document) => document.connectionId === deerConnectionId && document.documentKind === 'OTHER') && <div className="mt-3"><b className="text-[#082b4d]">Alte documente primite de la DEER</b><div className="mt-2 space-y-2">{borderouri.filter((document) => document.connectionId === deerConnectionId && document.documentKind === 'OTHER').map((document) => <div key={document.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3"><span className="min-w-0 flex-1 text-xs"><b className="block">{document.documentName}</b><span className="text-slate-500">{new Date(document.receivedAt).toLocaleString('ro-RO')}</span></span><a className="btn-secondary !px-3 !py-1 text-xs" href={`/api/formulare/borderou/${document.id}/document`} target="_blank" rel="noopener noreferrer">Vezi PDF</a></div>)}</div></div>}
        {canManage && pendingBorderouri.length > 0 && <div className="mt-3"><b className="text-amber-800">Documente DEER care necesită asociere ({pendingBorderouri.length})</b><div className="mt-2 space-y-2">{pendingBorderouri.map((document) => <div key={document.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2"><span className="min-w-0 flex-1 text-xs"><b className="block">{DEER_DOCUMENT_LABELS[document.documentKind]} · {document.beneficiary || document.documentName} · {document.dossierNumber || 'Număr dosar neidentificat'}</b><span className="block text-slate-600">{document.subject || 'Fără subiect'} · {new Date(document.receivedAt).toLocaleString('ro-RO')}</span></span><a className="btn-secondary !px-3 !py-1 text-xs" href={`/api/formulare/borderou/${document.id}/document`} target="_blank">Vezi PDF</a><select aria-label={`Asociază ${document.documentName}`} className="input-field !w-auto !py-1 text-xs" defaultValue="" disabled={!!busy} onChange={(event) => assignBorderou(document.id, event.target.value)}><option value="">Alege branșamentul</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.fields.Beneficiar || 'Fără beneficiar'} · {connection.nib}</option>)}</select></div>)}</div></div>}
      </div>}
      <section><div className="mb-3 flex items-center gap-2"><FilePlus2 size={18} className="text-[#197fb5]"/><h2 className="font-bold text-[#082b4d]">{category === 'DEER' ? 'Șabloane DEER' : tr('Modele de cereri')}</h2></div><div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{editableTemplates.map((item) => { const kind = deerDocumentKindForTemplate(item); const document = kind ? caseDocument(kind) : undefined; return <article key={item.id} className="flex min-h-[150px] flex-col rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf7fc] text-[#197fb5]"><FileText size={20}/></div><div className="min-w-0 flex-1">{renamingId === item.id ? <div className="flex gap-2"><input className="input-field min-w-0 flex-1 !py-1" value={renamedTitle} maxLength={180} onChange={(event) => setRenamedTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') renameForm(item); if (event.key === 'Escape') setRenamingId('') }}/><button className="btn-primary !px-2 !py-1 text-xs" disabled={!!busy || renamedTitle.trim().length < 2} onClick={() => renameForm(item)}>Salvează</button><button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setRenamingId('')}>Anulează</button></div> : <h3 className="font-extrabold text-[#082b4d]">{item.title}</h3>}<p className="mt-1 text-xs text-slate-400">{item.fieldSchema.length} {tr('câmpuri configurate')}{category === 'DEER' && <> · {item.stampSchema.length} semnături / ștampile</>}</p>{category === 'DEER' && <p className="mt-1 text-xs text-slate-400">Șablon actualizat: {new Date(item.updatedAt).toLocaleString('ro-RO')}</p>}</div></div>
        {category === 'DEER' && selectedDeerConnection && <p className="mt-2 text-xs font-semibold text-[#0d5d8b]">{kind ? document ? 'PDF propriu acestui branșament' : 'PDF lipsă pentru acest branșament' : submissionFor(item.id) ? 'Completare salvată pentru acest branșament' : 'Necompletat pentru acest branșament'} · {beneficiarySigned(submissionFor(item.id)?.values) ? 'beneficiarul a semnat' : 'fără semnătura beneficiarului'}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">{canEdit&&<button className="btn-primary inline-flex items-center gap-2 !px-4 !py-2 text-sm" disabled={category === 'DEER' && (!selectedDeerConnection || (!!kind && !document))} onClick={() => setEditor({ template: item, submission: category === 'DEER' ? submissionFor(item.id) : undefined })}><Edit3 size={16}/> {category === 'DEER' ? 'Completează și semnează' : tr('Completează pe PDF')}</button>}{(!kind || category !== 'DEER' || document) && (!item.documentPathname.startsWith('connection-document:') || selectedDeerConnection) && <a className="btn-secondary !px-3 !py-2 text-xs" href={item.documentPathname.startsWith('connection-document:') ? `/api/bransamente/${encodeURIComponent(selectedDeerConnection!.id)}/document?type=${item.documentPathname.slice('connection-document:'.length)}&format=pdf` : category === 'DEER' && kind ? `/api/formulare/borderou/${document!.id}/document` : `/api/formulare/${encodeURIComponent(item.id)}/document`} target="_blank" rel="noopener noreferrer">{item.documentPathname.startsWith('connection-document:') || category === 'DEER' && kind ? 'PDF branșament' : tr('PDF gol')}</a>}{canManage && category === 'DEER' && <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => { setRenamingId(item.id); setRenamedTitle(item.title) }}>Redenumește</button>}{canManage && !(category === 'DEER' && kind) && !item.documentPathname.startsWith('connection-document:') && <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 !px-3 !py-2 text-xs"><RefreshCw size={14}/> {tr('Înlocuiește')}<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => replaceForm(item, event.target.files?.[0])}/></label>}</div>
      </article>})}</div></section>
      <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><History size={18} className="text-[#197fb5]"/><h2 className="font-bold text-[#082b4d]">{tr('Completări salvate')}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{savedSubmissions.length}</span></div>
        {savedSubmissions.length ? <div className="divide-y divide-slate-100">{savedSubmissions.map((saved) => { const template = editableTemplates.find((item) => item.id === saved.formTemplateId); return <div key={saved.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-[240px] flex-1"><b className="block text-sm text-[#082b4d]">{saved.title}</b><span className="text-xs text-slate-400">{template?.title}{category === 'DEER' && saved.sourceId ? ` · ${connections.find((connection) => connection.id === saved.sourceId)?.nib || 'Branșament'}` : ''} · {new Date(saved.updatedAt).toLocaleString('ro-RO')}</span></div>{canEdit&&template && <button className="btn-secondary inline-flex items-center gap-2 !px-3 !py-2 text-xs" onClick={() => setEditor({ template, submission: saved })}><Edit3 size={14}/> {tr('Redeschide')}</button>}{canEdit&&<button className="round-action !text-red-600" onClick={() => removeSubmission(saved.id)}><Trash2 size={15}/></button>}</div> })}</div> : <p className="py-8 text-center text-sm text-slate-400">{category === 'DEER' ? 'Aici apar documentele completate după ce alegi branșamentul și apeși „Salvează completarea”. „Salvează șablonul” păstrează câmpurile și ștampilele în modelul de mai sus.' : tr('Nu există încă cereri completate și salvate.')}</p>}
      </section>
    </div>}

    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={() => !busy && setModalOpen(false)}><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold text-[#082b4d]">{category === 'FORMULAR' ? tr('Adaugă formular') : category === 'SEMNARE' ? tr('Adaugă șablon de semnare') : category === 'DEER' ? 'Adaugă șablon DEER' : tr('Adaugă model de cerere')}</h2><p className="mt-1 text-sm text-slate-500">{tr('Încarcă PDF-ul gol, care va rămâne fundalul documentului.')}</p></div><button className="round-action" onClick={() => setModalOpen(false)}><X size={17}/></button></div><label className="mt-5 block text-sm font-bold text-slate-600">{tr('Denumirea documentului')}<input className="input-field mt-1.5 w-full" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180}/></label><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[#8bc8e5] bg-[#f4fbfe] p-5"><FileText className="text-[#197fb5]"/><span className="min-w-0 flex-1"><b className="block text-sm text-[#082b4d]">{file?.name || tr('Selectează documentul PDF')}</b><small className="text-slate-500">{tr('Maximum 20 MB')}</small></span><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)}/></label><div className="mt-6 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setModalOpen(false)}>{tr('Renunță')}</button><button className="btn-primary inline-flex items-center gap-2" disabled={!title.trim() || !file || busy === 'add'} onClick={addForm}>{busy === 'add' ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>} {tr('Adaugă')}</button></div></div></div>}
    {stampEditor && <PdfStampEditor template={stampEditor} canManage={canManage} onClose={() => { setStampEditor(null); router.refresh() }}/>}
    {deerBulkOpen && selectedDeerConnection && <DeerBulkPreview key={`${selectedDeerConnection.id}:${signatureVersion}`} templates={bulkTemplates} submissions={initialSubmissions} connection={selectedDeerConnection} caseDocumentIds={Object.fromEntries(DEER_DOCUMENT_KINDS.map((kind) => [kind, caseDocument(kind)?.id]))} onClose={() => setDeerBulkOpen(false)}/>}
    {signatureOpen && selectedDeerConnection && <BeneficiarySignatureCapture connectionId={selectedDeerConnection.id} beneficiary={selectedDeerConnection.fields.Beneficiar || selectedDeerConnection.nib} onClose={() => setSignatureOpen(false)} onSaved={() => setSignatureVersion((value) => value + 1)}/>}
    {signingLinkOpen && selectedDeerConnection && <DeerSigningManager connection={selectedDeerConnection} templates={bulkTemplates} submissions={initialSubmissions} caseDocumentIds={Object.fromEntries(DEER_DOCUMENT_KINDS.map((kind) => [kind, caseDocument(kind)?.id]))} onClose={() => setSigningLinkOpen(false)}/>}
    {canEdit&&editor && <PdfRequestEditor template={editor.template} initialSubmission={editor.submission} defaultConnectionId={editor.template.category === 'DEER' ? deerConnectionId : undefined} connections={connections} projects={projects} identityCards={identityCards} borderouri={borderouri} canManage={canManage} onClose={() => { setEditor(null); router.refresh() }}/>}
  </div>
}
