'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Grip, Loader2, Minus, Plus, Printer, RefreshCw, RotateCcw, RotateCw, Save, Stamp, Trash2, X } from 'lucide-react'
import { uploadPresigned } from '@vercel/blob/client'
import { PDFDocument, degrees } from 'pdf-lib'
import { useRouter } from 'next/navigation'
import type { FormTemplateDto, StampPlacement } from '@/lib/ensure-form-storage'

const STAMPS = [
  { key: 's1-elmont-stamp', label: 'Ștampilă ELMONT', src: '/api/formulare/stamps/s1-elmont-stamp' },
  { key: 's2-signature', label: 'Semnătură 1', src: '/api/formulare/stamps/s2-signature' },
  { key: 's3-signature', label: 'Semnătură 2', src: '/api/formulare/stamps/s3-signature' },
  { key: 's4-elmont-signed', label: 'Ștampilă + semnătură', src: '/api/formulare/stamps/s4-elmont-signed' },
  { key: 's5-verificator-stamp', label: 'Ștampilă verificator', src: '/api/formulare/stamps/s5-verificator-stamp' },
] as const

const transparentCache = new Map<string, Promise<string>>()
function transparentImage(src: string) {
  const cached = transparentCache.get(src)
  if (cached) return cached
  const result = new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
      for (let index = 0; index < pixels.data.length; index += 4) {
        const white = Math.min(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2])
        pixels.data[index + 3] = white >= 248 ? 0 : white > 205 ? Math.round(255 * (248 - white) / 43) : pixels.data[index + 3]
      }
      context.putImageData(pixels, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => reject(new Error('Imaginea ștampilei nu a putut fi încărcată.'))
    image.src = src
  })
  transparentCache.set(src, result)
  return result
}

function PdfPage({ pdf, pageNumber }: { pdf: any; pageNumber: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.65 })
      if (cancelled || !ref.current) return
      const canvas = ref.current
      canvas.width = viewport.width; canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    })()
    return () => { cancelled = true }
  }, [pdf, pageNumber])
  return <canvas ref={ref} className="block h-auto w-full bg-white"/>
}

export function PdfStampEditor({ template, canManage, onClose }: { template: FormTemplateDto; canManage: boolean; onClose: () => void }) {
  const router = useRouter()
  const [pdf, setPdf] = useState<any>(null)
  const [pageCount, setPageCount] = useState(0)
  const [activePage, setActivePage] = useState(1)
  const [placements, setPlacements] = useState<StampPlacement[]>(template.stampSchema || [])
  const [images, setImages] = useState<Record<string, string>>({})
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState('')
  const [version, setVersion] = useState(0)
  const [error, setError] = useState('')
  const drag = useRef<{ id: string; kind: 'move' | 'resize'; startX: number; startY: number; item: StampPlacement; box: DOMRect } | null>(null)
  const documentUrl = `/api/formulare/${encodeURIComponent(template.id)}/document?v=${version}`
  const selected = placements.find((item) => item.id === selectedId)

  useEffect(() => {
    Promise.all(STAMPS.map(async (stamp) => [stamp.key, await transparentImage(stamp.src)] as const))
      .then((entries) => setImages(Object.fromEntries(entries))).catch((cause) => setError(cause.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        const response = await fetch(documentUrl)
        if (!response.ok) throw new Error('PDF-ul nu a putut fi deschis.')
        const loaded = await pdfjs.getDocument({ data: await response.arrayBuffer() }).promise
        if (!cancelled) { setPdf(loaded); setPageCount(loaded.numPages); setActivePage((page) => Math.min(page, loaded.numPages)) }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'PDF indisponibil.') }
    })()
    return () => { cancelled = true }
  }, [documentUrl])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = drag.current
      if (!current) return
      const dx = (event.clientX - current.startX) / current.box.width
      const dy = (event.clientY - current.startY) / current.box.height
      setPlacements((all) => all.map((item) => {
        if (item.id !== current.id) return item
        if (current.kind === 'resize') return { ...item, width: Math.max(.035, Math.min(1 - item.x, current.item.width + dx)), height: Math.max(.025, Math.min(1 - item.y, current.item.height + dy)) }
        return { ...item, x: Math.max(0, Math.min(1 - item.width, current.item.x + dx)), y: Math.max(0, Math.min(1 - item.height, current.item.y + dy)) }
      }))
    }
    const up = () => { drag.current = null }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [])

  function addStamp(stampKey: string) {
    if (!canManage) return
    const catalog = STAMPS.find((stamp) => stamp.key === stampKey)!
    const source = images[stampKey]
    const preview = new Image(); preview.src = source || catalog.src
    const ratio = preview.naturalWidth && preview.naturalHeight ? preview.naturalHeight / preview.naturalWidth : .7
    const width = stampKey.includes('signature') ? .16 : .18
    const height = Math.min(.24, width * ratio)
    const item: StampPlacement = { id: crypto.randomUUID(), stampKey, page: activePage, x: .5 - width / 2, y: .5 - height / 2, width, height, rotation: 0 }
    setPlacements((all) => [...all, item]); setSelectedId(item.id)
  }

  function startDrag(event: React.PointerEvent, item: StampPlacement, kind: 'move' | 'resize') {
    if (!canManage) return
    event.preventDefault(); event.stopPropagation()
    const box = (event.currentTarget.closest('[data-stamp-page]') as HTMLElement).getBoundingClientRect()
    drag.current = { id: item.id, kind, startX: event.clientX, startY: event.clientY, item: { ...item }, box }
    setSelectedId(item.id)
  }

  function updateSelected(patch: Partial<StampPlacement>) {
    setPlacements((all) => all.map((item) => item.id === selectedId ? { ...item, ...patch } : item))
  }

  async function saveTemplate() {
    setBusy('save'); setError('')
    try {
      const response = await fetch(`/api/formulare/${encodeURIComponent(template.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stampSchema: placements }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Șablonul nu a putut fi salvat.')
      router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Șablonul nu a putut fi salvat.') }
    finally { setBusy('') }
  }

  async function replacePdf(file?: File) {
    if (!file) return
    if (file.type !== 'application/pdf' || file.size > 20 * 1024 * 1024) return setError('Selectează un PDF de maximum 20 MB.')
    setBusy('replace'); setError('')
    try {
      const blob = await uploadPresigned(`formulare/semnare/${template.id.replace(/[^a-zA-Z0-9_-]/g, '-')}/${Date.now()}-${file.name}`, file, { access: 'private', handleUploadUrl: '/api/formulare/upload' })
      const response = await fetch(`/api/formulare/${encodeURIComponent(template.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentPathname: blob.pathname, documentName: file.name }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'PDF-ul nu a putut fi înlocuit.')
      setPdf(null); setPageCount(0); setVersion(Date.now()); router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'PDF-ul nu a putut fi înlocuit.') }
    finally { setBusy('') }
  }

  async function generatePdf() {
    const response = await fetch(documentUrl)
    if (!response.ok) throw new Error('PDF-ul sursă nu este disponibil.')
    const document = await PDFDocument.load(await response.arrayBuffer())
    const embedded = new Map<string, any>()
    for (const stamp of STAMPS) if (placements.some((item) => item.stampKey === stamp.key)) embedded.set(stamp.key, await document.embedPng(await fetch(images[stamp.key] || await transparentImage(stamp.src)).then((value) => value.arrayBuffer())))
    for (const item of placements) {
      const page = document.getPages()[item.page - 1]
      const image = embedded.get(item.stampKey)
      if (!page || !image) continue
      const width = item.width * page.getWidth(), height = item.height * page.getHeight()
      page.drawImage(image, { x: item.x * page.getWidth(), y: page.getHeight() - (item.y * page.getHeight()) - height, width, height, rotate: degrees(-item.rotation), opacity: 1 })
    }
    return document.save()
  }

  async function exportPdf(print: boolean) {
    setBusy(print ? 'print' : 'download'); setError('')
    try {
      const bytes = await generatePdf(); const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      if (print) {
        const frame = document.createElement('iframe'); frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;right:0;bottom:0'; frame.src = url
        frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(() => { frame.remove(); URL.revokeObjectURL(url) }, 5000) }; document.body.appendChild(frame)
      } else { const link = document.createElement('a'); link.href = url; link.download = `semnat-${template.documentName}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2500) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'PDF-ul semnat nu a putut fi generat.') }
    finally { setBusy('') }
  }

  const selectedCatalog = useMemo(() => STAMPS.find((stamp) => stamp.key === selected?.stampKey), [selected])

  return <div className="fixed inset-0 z-[85] flex flex-col bg-[#edf4f8]">
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <button className="round-action" onClick={onClose}><X size={18}/></button>
      <div className="mr-auto min-w-[220px]"><b className="block text-[#082b4d]">{template.title}</b><span className="text-xs text-slate-400">{template.documentName}</span></div>
      {canManage && <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 !py-2">{busy === 'replace' ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>} Înlocuiește PDF<input type="file" accept="application/pdf,.pdf" className="hidden" disabled={!!busy} onChange={(event) => { replacePdf(event.target.files?.[0]); event.currentTarget.value = '' }}/></label>}
      {canManage && <button className="btn-secondary inline-flex items-center gap-2 !py-2" disabled={!!busy} onClick={saveTemplate}>{busy === 'save' ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Salvează șablonul</button>}
      <button className="btn-secondary inline-flex items-center gap-2 !py-2" disabled={!!busy || !pdf} onClick={() => exportPdf(false)}><Download size={16}/> PDF semnat</button>
      <button className="btn-primary inline-flex items-center gap-2 !py-2" disabled={!!busy || !pdf} onClick={() => exportPdf(true)}><Printer size={16}/> Printează</button>
    </header>
    {error && <div className="bg-red-50 px-5 py-2 text-sm font-semibold text-red-700">{error}</div>}
    <div className="flex min-h-0 flex-1">
      <aside className="w-[230px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-black uppercase tracking-[.12em] text-[#0d5d8b]">Ștampile și semnături</p>
        <div className="space-y-2">{STAMPS.map((stamp) => <button key={stamp.key} disabled={!canManage} onClick={() => addStamp(stamp.key)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-2 text-left hover:border-[#78bfe1] hover:bg-[#f4fbfe] disabled:cursor-default"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(45deg,#edf2f7_25%,transparent_25%,transparent_75%,#edf2f7_75%),linear-gradient(45deg,#edf2f7_25%,white_25%,white_75%,#edf2f7_75%)] bg-[length:12px_12px]"><img src={images[stamp.key] || stamp.src} alt="" className="max-h-12 max-w-12 object-contain"/></span><span className="text-xs font-bold text-[#082b4d]">{stamp.label}</span></button>)}</div>
        <p className="mt-4 text-[11px] leading-5 text-slate-500">Selectează pagina, apoi apasă o ștampilă. Trage pentru poziționare și folosește colțul albastru pentru redimensionare.</p>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6">
        {!pdf && !error && <div className="flex h-full items-center justify-center text-[#197fb5]"><Loader2 className="animate-spin" size={30}/></div>}
        <div className="mx-auto max-w-[900px] space-y-7">{pdf && Array.from({ length: pageCount }, (_, index) => {
          const pageNumber = index + 1
          return <div key={pageNumber} data-stamp-page onMouseDown={() => setActivePage(pageNumber)} className={`relative overflow-hidden bg-white shadow-xl ring-2 ${activePage === pageNumber ? 'ring-[#2a91c2]' : 'ring-transparent'}`}>
            <PdfPage pdf={pdf} pageNumber={pageNumber}/><div className="absolute inset-0">
              {placements.filter((item) => item.page === pageNumber).map((item) => <div key={item.id} onMouseDown={() => setSelectedId(item.id)} className={`group absolute ${selectedId === item.id ? 'z-20 ring-2 ring-[#1685bc]' : 'z-10'}`} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.width * 100}%`, height: `${item.height * 100}%`, transform: `rotate(${item.rotation}deg)` }}>
                <img src={images[item.stampKey] || STAMPS.find((stamp) => stamp.key === item.stampKey)?.src} alt="Ștampilă" className="h-full w-full select-none object-fill" draggable={false}/>
                {canManage && <><button onPointerDown={(event) => startDrag(event, item, 'move')} className="absolute -left-3 -top-3 flex h-7 w-7 cursor-move items-center justify-center rounded-full bg-[#0d5d8b] text-white shadow"><Grip size={13}/></button><button onPointerDown={(event) => startDrag(event, item, 'resize')} className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded bg-[#1685bc] shadow"/></>}
              </div>)}
            </div><span className="absolute bottom-2 right-2 rounded-md bg-slate-950/55 px-2 py-1 text-[10px] font-bold text-white">Pagina {pageNumber}</span>
          </div>
        })}</div>
      </main>
      {selected && canManage && <aside className="w-[220px] shrink-0 border-l border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-[.1em] text-[#0d5d8b]">Element selectat</p><p className="mt-2 text-sm font-bold text-[#082b4d]">{selectedCatalog?.label}</p><div className="mt-4 flex items-center gap-2"><button className="round-action" title="Rotire stânga" onClick={() => updateSelected({ rotation: selected.rotation - 5 })}><RotateCcw size={16}/></button><span className="min-w-12 text-center text-xs font-bold">{selected.rotation}°</span><button className="round-action" title="Rotire dreapta" onClick={() => updateSelected({ rotation: selected.rotation + 5 })}><RotateCw size={16}/></button></div><div className="mt-3 flex items-center gap-2"><button className="round-action" title="Micșorează" onClick={() => updateSelected({ width: Math.max(.03, selected.width * .92), height: Math.max(.02, selected.height * .92) })}><Minus size={16}/></button><button className="round-action" title="Mărește" onClick={() => updateSelected({ width: Math.min(1 - selected.x, selected.width * 1.08), height: Math.min(1 - selected.y, selected.height * 1.08) })}><Plus size={16}/></button></div><button className="btn-secondary mt-4 inline-flex w-full items-center justify-center gap-2 !text-rose-600" onClick={() => { setPlacements((all) => all.filter((item) => item.id !== selected.id)); setSelectedId('') }}><Trash2 size={15}/> Elimină</button><div className="mt-5 rounded-xl bg-[#edf7fc] p-3 text-xs leading-5 text-slate-600"><Stamp size={16} className="mb-1 text-[#197fb5]"/>Fundalul alb este eliminat automat la afișare și la exportul PDF.</div></aside>}
    </div>
  </div>
}
