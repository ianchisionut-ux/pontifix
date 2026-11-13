'use client'

import type { FormField, FormSubmissionDto, FormTemplateDto, StampPlacement } from './ensure-form-storage'
import { deerDocumentKindForTemplate, type DeerDocumentKind } from './deer-borderou-shared'
import { boundValue, loadImage, transparentStamp, type ConnectionFormOption } from '@/components/forms/pdf-request-editor'
import { effectiveStampPlacements } from '@/components/forms/form-stamps'

export type SigningDocument = { id: string; title: string; firstPage: number; pageCount: number; signatures: Array<{ page: number; x: number; y: number; width: number; height: number; rotation: number }> }

function fieldText(field: FormField, submission: FormSubmissionDto | undefined, connection: ConnectionFormOption) {
  return field.binding ? boundValue(field.binding, connection) || submission?.values[field.id] || '' : submission?.values[field.id] ?? field.defaultValue ?? ''
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
  if (!field.multiline) { context.fillText(value, x, y, maxWidth); return }
  const words = value.split(/\s+/)
  let line = ''
  let lineNo = 0
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (context.measureText(next).width > maxWidth && line) { context.fillText(line, x, y + lineNo++ * size * 1.18); line = word }
    else line = next
  }
  if (line) context.fillText(line, x, y + lineNo * size * 1.18)
}

/** Creates the exact, unsigned PDF snapshot the beneficiary reviews. */
export async function buildDeerSigningBundle(templates: FormTemplateDto[], submissions: FormSubmissionDto[], connection: ConnectionFormOption, caseDocumentIds: Partial<Record<DeerDocumentKind, string>>, onProgress?: (title: string) => void) {
  const [pdfjs, { PDFDocument }] = await Promise.all([import('pdfjs-dist'), import('pdf-lib')])
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const output = await PDFDocument.create()
  const documents: SigningDocument[] = []
  let pageIndex = 0
  for (const template of templates) {
    onProgress?.(template.title)
    const kind = deerDocumentKindForTemplate(template)
    const caseDocumentId = kind ? caseDocumentIds[kind] : undefined
    const documentUrl = template.documentPathname.startsWith('connection-document:')
      ? `/api/bransamente/${encodeURIComponent(connection.id)}/document?type=${encodeURIComponent(template.documentPathname.slice('connection-document:'.length))}&format=pdf`
      : kind && caseDocumentId ? `/api/formulare/borderou/${encodeURIComponent(caseDocumentId)}/document`
      : `/api/formulare/${encodeURIComponent(template.id)}/document`
    const response = await fetch(documentUrl, { cache: 'no-store' })
    if (!response.ok) throw new Error(`PDF-ul „${template.title}” nu poate fi deschis.`)
    const loadingTask = pdfjs.getDocument({ data: await response.arrayBuffer(), wasmUrl: '/pdfjs/wasm/' })
    const pdf = await loadingTask.promise
    try {
      const submission = submissions.find((item) => item.formTemplateId === template.id && item.sourceId === connection.id)
      const fields = submission?.fieldSchema?.length ? submission.fieldSchema : template.fieldSchema
      const stamps: StampPlacement[] = effectiveStampPlacements(template.stampSchema, submission?.stampSchema)
      const signatures = stamps.filter((item) => item.stampKey === 'beneficiary-signature' && item.page >= 1 && item.page <= pdf.numPages).map((item) => ({ page: pageIndex + item.page, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation }))
      documents.push({ id: template.id, title: template.title, firstPage: pageIndex + 1, pageCount: pdf.numPages, signatures })
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber)
        const scale = template.documentPathname.startsWith('connection-document:') ? 1.6 : 2.5
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('PDF-ul nu poate fi pregătit pe acest dispozitiv.')
        await page.render({ canvas, canvasContext: context, viewport }).promise
        for (const field of fields.filter((item) => item.page === pageNumber)) drawField(context, canvas, field, fieldText(field, submission, connection), scale)
        for (const stamp of stamps.filter((item) => item.page === pageNumber && item.stampKey !== 'beneficiary-signature')) {
          const source = await transparentStamp(stamp.stampKey)
          if (!source) continue
          const image = await loadImage(source)
          context.save()
          context.translate((stamp.x + stamp.width / 2) * canvas.width, (stamp.y + stamp.height / 2) * canvas.height)
          context.rotate(stamp.rotation * Math.PI / 180)
          context.drawImage(image, -stamp.width * canvas.width / 2, -stamp.height * canvas.height / 2, stamp.width * canvas.width, stamp.height * canvas.height)
          context.restore()
        }
        const image = await output.embedJpg(canvas.toDataURL('image/jpeg', .92))
        const outPage = output.addPage([viewport.width / scale, viewport.height / scale])
        outPage.drawImage(image, { x: 0, y: 0, width: outPage.getWidth(), height: outPage.getHeight() })
        pageIndex++
      }
    } finally { await loadingTask.destroy() }
  }
  if (!documents.length) throw new Error('Nu există documente pentru acest branșament.')
  if (!documents.some((item) => item.signatures.length)) throw new Error('Așază mai întâi „Semnătura beneficiarului” pe documentele care trebuie semnate.')
  return { bytes: await output.save(), documents }
}
