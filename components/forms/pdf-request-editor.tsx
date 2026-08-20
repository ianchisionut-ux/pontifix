'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Grip, Link2, Loader2, Plus, Printer, RefreshCw, Save, Settings2, Trash2, X } from 'lucide-react'
import { uploadPresigned } from '@vercel/blob/client'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/language-provider'
import type { FormField, FormSubmissionDto, FormTemplateDto } from '@/lib/ensure-form-storage'
import { CONNECTION_FIELDS, CONNECTION_FIELD_LABELS } from '@/lib/connection-fields'

export type ConnectionFormOption = { id: string; nib: string; sequenceNumber: number; status: string; deerSubmittedAt: string; createdAt: string; fields: Record<string, string> }
export type ProjectFormOption = { id: string; name: string; beneficiary: string; beneficiaryPhone: string; address: string; certificateNumber: string; certificateDate: string }

const BINDINGS: ReadonlyArray<readonly [string, string]> = [
  ['', 'Completare manuală'],
  ['connection.NIB', 'Branșament: NIB'],
  ['connection.sequenceNumber', 'Branșament: Număr de ordine'],
  ['connection.status', 'Branșament: Stadiu dosar'],
  ['connection.deerSubmittedAt', 'Branșament: Data predării la DEER'],
  ['connection.createdAt', 'Branșament: Data înregistrării'],
  ['connection.object', 'Branșament: Obiect complet'],
  ...CONNECTION_FIELDS.map((field) => [`connection.${field}`, `Branșament: ${CONNECTION_FIELD_LABELS[field] || field}`] as const),
  ['project.name', 'Proiect: Denumire'], ['project.beneficiary', 'Proiect: Beneficiar'],
  ['project.beneficiaryPhone', 'Proiect: Telefon beneficiar'], ['project.address', 'Proiect: Amplasament / adresă'],
  ['project.certificateNumber', 'Proiect: Număr certificat'], ['project.certificateDate', 'Proiect: Data certificatului'],
]

function boundValue(binding: string | undefined, connection?: ConnectionFormOption, project?: ProjectFormOption) {
  if (!binding) return ''
  if (binding.startsWith('project.')) return project?.[binding.replace('project.', '') as keyof ProjectFormOption] || ''
  if (!connection) return ''
  if (binding === 'connection.NIB') return connection.nib
  if (binding === 'connection.sequenceNumber') return String(connection.sequenceNumber)
  if (binding === 'connection.status') return connection.status
  if (binding === 'connection.deerSubmittedAt') return connection.deerSubmittedAt
  if (binding === 'connection.createdAt') return connection.createdAt
  if (binding === 'connection.object') {
    const f = connection.fields
    const address = f.Amplasament || [f.Oras, f.Strada && `Str. ${f.Strada}`, f.Nr && `nr. ${f.Nr}`].filter(Boolean).join(', ')
    return [f.TipBransament, address].filter(Boolean).join(' - ')
  }
  return connection.fields[binding.replace('connection.', '')] || ''
}

function PdfCanvas({ pdf, pageNumber }: { pdf: any; pageNumber: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const page = await pdf.getPage(pageNumber)
      if (cancelled || !ref.current) return
      const viewport = page.getViewport({ scale: 1.75 })
      const canvas = ref.current
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    })()
    return () => { cancelled = true }
  }, [pdf, pageNumber])
  return <canvas ref={ref} className="block h-auto w-full bg-white" />
}

export function PdfRequestEditor({ template, initialSubmission, connections, projects, canManage, onClose }: {
  template: FormTemplateDto
  initialSubmission?: FormSubmissionDto
  connections: ConnectionFormOption[]
  projects: ProjectFormOption[]
  canManage: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { tr } = useLanguage()
  const [pdf, setPdf] = useState<any>(null)
  const [pageCount, setPageCount] = useState(0)
  const [fields, setFields] = useState<FormField[]>(() => initialSubmission?.fieldSchema?.length ? initialSubmission.fieldSchema : template.fieldSchema)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const saved = initialSubmission?.values || {}
    return Object.fromEntries((initialSubmission?.fieldSchema?.length ? initialSubmission.fieldSchema : template.fieldSchema).map((field) => [field.id, saved[field.id] ?? field.defaultValue ?? '']))
  })
  const [sourceId, setSourceId] = useState(initialSubmission?.sourceId ? `${initialSubmission.sourceType?.toLowerCase()}:${initialSubmission.sourceId}` : '')
  const [submissionId, setSubmissionId] = useState(initialSubmission?.id || '')
  const [title, setTitle] = useState(initialSubmission?.title || template.title)
  const [layoutMode, setLayoutMode] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [activePage, setActivePage] = useState(1)
  const [busy, setBusy] = useState('')
  const [documentVersion, setDocumentVersion] = useState(0)
  const [error, setError] = useState('')
  const drag = useRef<{ id: string; kind: 'move' | 'resize'; startX: number; startY: number; field: FormField; box: DOMRect } | null>(null)
  const documentUrl = `/api/formulare/${encodeURIComponent(template.id)}/document?v=${documentVersion}`
  const selected = fields.find((field) => field.id === selectedId)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        const data = await fetch(documentUrl).then((response) => {
          if (!response.ok) throw new Error('PDF-ul nu a putut fi deschis.')
          return response.arrayBuffer()
        })
        const loaded = await pdfjs.getDocument({ data }).promise
        if (!cancelled) { setPdf(loaded); setPageCount(loaded.numPages) }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'PDF indisponibil.') }
    })()
    return () => { cancelled = true }
  }, [documentUrl])

  useEffect(() => {
    function move(event: PointerEvent) {
      const current = drag.current
      if (!current) return
      const dx = (event.clientX - current.startX) / current.box.width
      const dy = (event.clientY - current.startY) / current.box.height
      setFields((all) => all.map((field) => {
        if (field.id !== current.id) return field
        if (current.kind === 'resize') return { ...field, width: Math.max(.04, Math.min(1 - field.x, current.field.width + dx)), height: Math.max(.018, Math.min(1 - field.y, current.field.height + dy)) }
        return { ...field, x: Math.max(0, Math.min(1 - field.width, current.field.x + dx)), y: Math.max(0, Math.min(1 - field.height, current.field.y + dy)) }
      }))
    }
    function up() { drag.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [])

  function chooseSource(value: string) {
    setSourceId(value)
    const [kind, id] = value.split(':')
    const connection = kind === 'connection' ? connections.find((item) => item.id === id) : undefined
    const project = kind === 'project' ? projects.find((item) => item.id === id) : undefined
    if (!connection && !project) return
    setValues((current) => {
      const next = { ...current }
      for (const field of fields) if (field.binding) next[field.id] = boundValue(field.binding, connection, project) || next[field.id] || ''
      return next
    })
    const subject = connection?.fields.Beneficiar || connection?.nib || project?.beneficiary || project?.name
    if (!submissionId && subject) setTitle(`${template.title} - ${subject}`)
  }

  function startDrag(event: React.PointerEvent, field: FormField, kind: 'move' | 'resize') {
    event.preventDefault(); event.stopPropagation()
    const box = (event.currentTarget.closest('[data-pdf-page]') as HTMLElement).getBoundingClientRect()
    drag.current = { id: field.id, kind, startX: event.clientX, startY: event.clientY, field: { ...field }, box }
    setSelectedId(field.id)
  }

  function addField() {
    const label = window.prompt('Denumirea câmpului nou:', 'Câmp nou')?.trim()
    if (!label) return
    const id = `field_${Date.now()}`
    setFields((all) => [...all, { id, label, page: activePage, x: .1, y: .1, width: .25, height: .028, fontSize: 12 }])
    setValues((current) => ({ ...current, [id]: '' }))
    setSelectedId(id); setLayoutMode(true)
  }

  function updateField(patch: Partial<FormField>) {
    setFields((all) => all.map((field) => field.id === selectedId ? { ...field, ...patch } : field))
  }

  async function replacePdf(file?: File) {
    if (!file) return
    if (file.type !== 'application/pdf') return setError('Fișierul trebuie să fie PDF.')
    if (file.size > 20 * 1024 * 1024) return setError('PDF-ul poate avea maximum 20 MB.')
    setBusy('replace'); setError('')
    try {
      const safeId = template.id.replace(/[^a-zA-Z0-9_-]/g, '-')
      const blob = await uploadPresigned(`formulare/${safeId}/${Date.now()}-${file.name}`, file, { access: 'private', handleUploadUrl: '/api/formulare/upload' })
      const response = await fetch(`/api/formulare/${encodeURIComponent(template.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentPathname: blob.pathname, documentName: file.name }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'PDF-ul nu a putut fi înlocuit.')
      setPdf(null); setPageCount(0); setDocumentVersion(Date.now()); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'PDF-ul nu a putut fi înlocuit.') }
    finally { setBusy('') }
  }

  async function saveModel() {
    setBusy('model'); setError('')
    try {
      const response = await fetch(`/api/formulare/${encodeURIComponent(template.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fieldSchema: fields }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Modelul nu a putut fi salvat.')
      router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Modelul nu a putut fi salvat.') }
    finally { setBusy('') }
  }

  async function saveSubmission() {
    setBusy('save'); setError('')
    try {
      const response = await fetch('/api/formulare/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        id: submissionId || undefined, formTemplateId: template.id, title,
        sourceType: sourceId ? sourceId.split(':')[0].toUpperCase() : null,
        sourceId: sourceId ? sourceId.split(':').slice(1).join(':') : null, values, fieldSchema: fields,
      }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Cererea nu a putut fi salvată.')
      setSubmissionId(body.id); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Cererea nu a putut fi salvată.') }
    finally { setBusy('') }
  }

  async function generatePdf() {
    if (!pdf) throw new Error('PDF-ul se încarcă încă.')
    const { PDFDocument } = await import('pdf-lib')
    const output = await PDFDocument.create()
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 2.5 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
      const context = canvas.getContext('2d')!
      await page.render({ canvasContext: context, viewport }).promise
      context.fillStyle = '#111827'; context.textBaseline = 'top'
      for (const field of fields.filter((item) => item.page === pageNumber)) {
        const value = values[field.id] || ''
        if (!value) continue
        const size = field.fontSize * 2.5
        context.font = `${size}px Arial, sans-serif`
        const x = field.x * canvas.width, y = field.y * canvas.height, maxWidth = field.width * canvas.width
        if (field.multiline) {
          const words = value.split(/\s+/); let line = '', lineNo = 0
          for (const word of words) {
            const test = line ? `${line} ${word}` : word
            if (context.measureText(test).width > maxWidth && line) { context.fillText(line, x, y + lineNo++ * size * 1.18); line = word } else line = test
          }
          if (line) context.fillText(line, x, y + lineNo * size * 1.18)
        } else context.fillText(value, x, y, maxWidth)
      }
      const png = await output.embedPng(canvas.toDataURL('image/png'))
      const outPage = output.addPage([viewport.width / 2.5, viewport.height / 2.5])
      outPage.drawImage(png, { x: 0, y: 0, width: outPage.getWidth(), height: outPage.getHeight() })
    }
    return output.save()
  }

  async function downloadOrPrint(print: boolean) {
    setBusy(print ? 'print' : 'download'); setError('')
    try {
      const bytes = await generatePdf()
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      if (print) {
        const frame = document.createElement('iframe')
        frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;right:0;bottom:0'
        frame.src = url
        frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(() => { frame.remove(); URL.revokeObjectURL(url) }, 5000) }
        document.body.appendChild(frame)
      } else {
        const link = document.createElement('a'); link.href = url; link.download = `${title.replace(/[^a-z0-9ăâîșț -]/gi, '').replace(/\s+/g, '-') || 'cerere'}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'PDF-ul nu a putut fi generat.') }
    finally { setBusy('') }
  }

  const selectedConnection = useMemo(() => sourceId.startsWith('connection:') ? connections.find((item) => item.id === sourceId.slice(11)) : undefined, [connections, sourceId])
  const selectedProject = useMemo(() => sourceId.startsWith('project:') ? projects.find((item) => item.id === sourceId.slice(8)) : undefined, [projects, sourceId])

  return <div className="fixed inset-0 z-[80] flex flex-col bg-[#eef4f8]">
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <button className="round-action mr-1" onClick={onClose}><X size={18}/></button>
      <input className="min-w-[260px] flex-1 border-0 bg-transparent text-lg font-bold text-[#082b4d] outline-none" value={title} onChange={(e) => setTitle(e.target.value)}/>
      <select className="input-field !w-auto min-w-[290px] !py-2" value={sourceId} onChange={(e) => chooseSource(e.target.value)}>
        <option value="">{tr('Fără legătură - completare manuală')}</option>
        <optgroup label={tr('Branșamente')}>{connections.map((item) => <option key={item.id} value={`connection:${item.id}`}>{item.nib} - {item.fields.Beneficiar || tr('Fără beneficiar')}</option>)}</optgroup>
        <optgroup label={tr('Proiecte')}>{projects.map((item) => <option key={item.id} value={`project:${item.id}`}>{item.name} - {item.beneficiary || tr('Fără beneficiar')}</option>)}</optgroup>
      </select>
      {canManage && <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 !py-2">{busy === 'replace' ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>} {tr('Înlocuiește')} PDF<input type="file" accept="application/pdf,.pdf" className="hidden" disabled={!!busy} onChange={(event) => { replacePdf(event.target.files?.[0]); event.currentTarget.value = '' }}/></label>}
      {canManage && <button className={`btn-secondary inline-flex items-center gap-2 !py-2 ${layoutMode ? '!border-[#197fb5] !bg-[#edf7fc]' : ''}`} onClick={() => setLayoutMode((value) => !value)}><Settings2 size={16}/> {tr('Poziționare')}</button>}
      {canManage && <button className="btn-secondary inline-flex items-center gap-2 !py-2" onClick={addField}><Plus size={16}/> {tr('Câmp')}</button>}
      <button className="btn-secondary inline-flex items-center gap-2 !py-2" disabled={!!busy} onClick={saveSubmission}>{busy === 'save' ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} {tr('Salvează')}</button>
      <button className="btn-secondary inline-flex items-center gap-2 !py-2" disabled={!!busy || !pdf} onClick={() => downloadOrPrint(false)}><Download size={16}/> PDF</button>
      <button className="btn-primary inline-flex items-center gap-2 !py-2" disabled={!!busy || !pdf} onClick={() => downloadOrPrint(true)}>{busy === 'print' ? <Loader2 className="animate-spin" size={16}/> : <Printer size={16}/>} {tr('Printează')}</button>
    </header>
    {error && <div className="bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div>}
    <div className="flex min-h-0 flex-1">
      <main className="min-w-0 flex-1 overflow-auto p-6">
        {!pdf && !error && <div className="flex h-full items-center justify-center text-[#197fb5]"><Loader2 className="animate-spin" size={28}/></div>}
        <div className="mx-auto max-w-[820px] space-y-6">
          {pdf && Array.from({ length: pageCount }, (_, index) => {
            const pageNumber = index + 1
            return <div key={pageNumber} data-pdf-page onMouseDown={() => setActivePage(pageNumber)} className="relative overflow-hidden bg-white shadow-xl">
              <PdfCanvas pdf={pdf} pageNumber={pageNumber}/>
              <div className="absolute inset-0">
                {fields.filter((field) => field.page === pageNumber).map((field) => <div key={field.id} onClick={() => setSelectedId(field.id)} className={`absolute group ${selectedId === field.id ? 'z-20' : 'z-10'}`} style={{ left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.width * 100}%`, height: `${field.height * 100}%` }}>
                  {field.multiline ? <textarea aria-label={field.label} value={values[field.id] || ''} onChange={(e) => setValues((all) => ({ ...all, [field.id]: e.target.value }))} className={`h-full w-full resize-none overflow-hidden bg-white/65 px-0.5 leading-tight text-slate-950 outline-none ${layoutMode ? 'border border-dashed border-[#197fb5]' : 'border border-transparent focus:border-[#197fb5]'}`} style={{ fontSize: `${field.fontSize * 1.334}px` }}/> :
                  <input aria-label={field.label} value={values[field.id] || ''} onChange={(e) => setValues((all) => ({ ...all, [field.id]: e.target.value }))} className={`h-full w-full bg-white/65 px-0.5 text-slate-950 outline-none ${layoutMode ? 'border border-dashed border-[#197fb5]' : 'border border-transparent focus:border-[#197fb5]'}`} style={{ fontSize: `${field.fontSize * 1.334}px` }}/>}
                  {layoutMode && <><button title="Mută" onPointerDown={(e) => startDrag(e, field, 'move')} className="absolute -left-3 -top-3 flex h-6 w-6 cursor-move items-center justify-center rounded-full bg-[#0d5d8b] text-white shadow"><Grip size={12}/></button><button title="Redimensionează" onPointerDown={(e) => startDrag(e, field, 'resize')} className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm bg-[#197fb5] shadow"/></>}
                </div>)}
              </div>
              <span className="absolute bottom-2 right-2 rounded bg-slate-900/65 px-2 py-1 text-[10px] text-white">Pagina {pageNumber}</span>
            </div>
          })}
        </div>
      </main>
      {layoutMode && canManage && <aside className="w-[320px] shrink-0 overflow-auto border-l border-slate-200 bg-white p-4">
        <div className="mb-4 flex items-center gap-2"><Link2 size={17} className="text-[#197fb5]"/><b className="text-sm text-[#082b4d]">{tr('Configurare câmp')}</b></div>
        {!selected ? <p className="text-sm leading-6 text-slate-500">{tr('Selectează un câmp de pe PDF sau adaugă unul nou.')}</p> : <div className="space-y-4">
          <label className="block text-xs font-bold text-slate-500">{tr('Denumire')}<input className="input-field mt-1 w-full" value={selected.label} onChange={(e) => updateField({ label: e.target.value })}/></label>
          <label className="block text-xs font-bold text-slate-500">{tr('Preia automat din')}<select className="input-field mt-1 w-full" value={selected.binding || ''} onChange={(e) => { updateField({ binding: e.target.value || undefined }); const value = boundValue(e.target.value, selectedConnection, selectedProject); if (value) setValues((all) => ({ ...all, [selected.id]: value })) }}>{BINDINGS.map(([value, label]) => <option key={value} value={value}>{tr(label)}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-500">{tr('Pagina')}<input type="number" min={1} max={pageCount || 50} className="input-field mt-1 w-full" value={selected.page} onChange={(e) => updateField({ page: Number(e.target.value) || 1 })}/></label><label className="text-xs font-bold text-slate-500">{tr('Font')}<input type="number" min={6} max={40} className="input-field mt-1 w-full" value={selected.fontSize} onChange={(e) => updateField({ fontSize: Number(e.target.value) || 12 })}/></label></div>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={!!selected.multiline} onChange={(e) => updateField({ multiline: e.target.checked })}/> {tr('Text pe mai multe rânduri')}</label>
          <button className="inline-flex items-center gap-2 text-sm font-bold text-red-600" onClick={() => { setFields((all) => all.filter((item) => item.id !== selected.id)); setSelectedId('') }}><Trash2 size={15}/> {tr('Șterge câmpul')}</button>
        </div>}
        <div className="mt-6 border-t border-slate-200 pt-5"><button className="btn-primary flex w-full items-center justify-center gap-2" disabled={busy === 'model'} onClick={saveModel}>{busy === 'model' ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} {tr('Salvează')} ca model</button><p className="mt-2 text-xs leading-5 text-slate-400">{tr('Pozițiile și legăturile vor fi reutilizate la următoarele completări.')}</p></div>
      </aside>}
    </div>
  </div>
}
