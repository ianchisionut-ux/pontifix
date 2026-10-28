'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, Printer, X } from 'lucide-react'
import type { FormField, FormSubmissionDto, FormTemplateDto, StampPlacement } from '@/lib/ensure-form-storage'
import { boundValue, loadImage, transparentStamp, type ConnectionFormOption } from './pdf-request-editor'

type PreviewProps = {
  templates: FormTemplateDto[]
  submissions: FormSubmissionDto[]
  connection: ConnectionFormOption
  onClose: () => void
}

function fieldText(field: FormField, submission: FormSubmissionDto | undefined, connection: ConnectionFormOption) {
  if (field.binding) return boundValue(field.binding, connection) || submission?.values[field.id] || ''
  return submission?.values[field.id] ?? field.defaultValue ?? ''
}

function drawField(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, field: FormField, value: string, scale: number) {
  if (!value) return
  const size = field.fontSize * scale
  context.textBaseline = 'top'
  context.fillStyle = field.color || '#111827'
  context.font = `${field.bold ? 'bold ' : ''}${size}px Arial, sans-serif`
  const x = field.x * canvas.width
  const y = field.y * canvas.height
  const maxWidth = field.width * canvas.width
  if (!field.multiline) {
    context.fillText(value, x, y, maxWidth)
    return
  }
  const words = value.split(/\s+/)
  let line = ''
  let lineNo = 0
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, y + lineNo++ * size * 1.18)
      line = word
    } else line = next
  }
  if (line) context.fillText(line, x, y + lineNo * size * 1.18)
}

export function DeerBulkPreview({ templates, submissions, connection, onClose }: PreviewProps) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [current, setCurrent] = useState('')
  const [pageCount, setPageCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    let url = ''
    const controller = new AbortController()
    ;(async () => {
      try {
        const [pdfjs, { PDFDocument }] = await Promise.all([import('pdfjs-dist'), import('pdf-lib')])
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        const output = await PDFDocument.create()
        let pages = 0
        for (const template of templates) {
          if (cancelled) return
          setCurrent(template.title)
          const response = await fetch(`/api/formulare/${encodeURIComponent(template.id)}/document`, { signal: controller.signal })
          if (!response.ok) throw new Error(`PDF-ul „${template.title}” nu poate fi deschis.`)
          const loadingTask = pdfjs.getDocument({ data: await response.arrayBuffer(), wasmUrl: '/pdfjs/wasm/' })
          const pdf = await loadingTask.promise
          const submission = submissions.find((item) => item.formTemplateId === template.id && item.sourceId === connection.id)
          const fields = submission?.fieldSchema?.length ? submission.fieldSchema : template.fieldSchema
          const stamps: StampPlacement[] = submission ? submission.stampSchema : template.stampSchema
          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            if (cancelled) return
            const page = await pdf.getPage(pageNumber)
            const scale = 2.5
            const viewport = page.getViewport({ scale })
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(viewport.width)
            canvas.height = Math.round(viewport.height)
            const context = canvas.getContext('2d')
            if (!context) throw new Error('Previzualizarea PDF nu este disponibilă în acest browser.')
            await page.render({ canvas, canvasContext: context, viewport }).promise
            for (const field of fields.filter((item) => item.page === pageNumber)) {
              drawField(context, canvas, field, fieldText(field, submission, connection), scale)
            }
            for (const stamp of stamps.filter((item) => item.page === pageNumber)) {
              const image = await loadImage(await transparentStamp(stamp.stampKey))
              const width = stamp.width * canvas.width
              const height = stamp.height * canvas.height
              context.save()
              context.translate((stamp.x + stamp.width / 2) * canvas.width, (stamp.y + stamp.height / 2) * canvas.height)
              context.rotate(stamp.rotation * Math.PI / 180)
              context.drawImage(image, -width / 2, -height / 2, width, height)
              context.restore()
            }
            const image = await output.embedJpg(canvas.toDataURL('image/jpeg', .94))
            const outPage = output.addPage([viewport.width / scale, viewport.height / scale])
            outPage.drawImage(image, { x: 0, y: 0, width: outPage.getWidth(), height: outPage.getHeight() })
            pages++
            setPageCount(pages)
          }
          await loadingTask.destroy()
        }
        if (!pages) throw new Error('Nu există pagini de previzualizat.')
        const bytes = await output.save()
        if (cancelled) return
        url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
        setPreviewUrl(url)
        setCurrent('')
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Documentele nu au putut fi pregătite.')
      }
    })()
    return () => { cancelled = true; controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [templates, submissions, connection])

  function printAll() {
    if (!previewUrl) return
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;right:0;bottom:0'
    frame.src = previewUrl
    frame.onload = () => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print() }
      catch { window.open(previewUrl, '_blank', 'noopener,noreferrer') }
      setTimeout(() => frame.remove(), 15000)
    }
    document.body.appendChild(frame)
  }

  return <div className="fixed inset-0 z-[90] flex flex-col bg-[#edf4f8]">
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
      <button type="button" className="round-action" onClick={onClose} aria-label="Închide previzualizarea"><X size={18}/></button>
      <div className="mr-auto"><b className="block text-[#082b4d]">Documente DEER · {connection.fields.Beneficiar || connection.nib}</b><span className="text-xs text-slate-500">{templates.length} șabloane · {pageCount} pagini</span></div>
      <a href={previewUrl || undefined} download={`DEER-${connection.nib || 'documente'}.pdf`} aria-disabled={!previewUrl} className={`btn-secondary inline-flex items-center gap-2 !py-2 ${!previewUrl ? 'pointer-events-none opacity-50' : ''}`}><Download size={16}/> Descarcă toate</a>
      <button type="button" className="btn-primary inline-flex items-center gap-2 !py-2" disabled={!previewUrl} onClick={printAll}><Printer size={16}/> Printează toate</button>
    </header>
    {error ? <div role="alert" className="m-5 rounded-xl bg-red-50 p-4 font-semibold text-red-700">{error}</div> : previewUrl ? <iframe title="Previzualizarea tuturor documentelor DEER" src={`${previewUrl}#toolbar=0&navpanes=0`} className="min-h-0 flex-1 bg-white"/> : <div role="status" className="flex flex-1 items-center justify-center gap-3 text-[#0d5d8b]"><Loader2 className="animate-spin" size={22}/> Pregătesc {current || 'documentele'}…</div>}
  </div>
}
