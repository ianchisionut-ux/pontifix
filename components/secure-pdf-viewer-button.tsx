'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileText, Loader2, Minus, Plus, X } from 'lucide-react'

function PdfPage({ pdf, pageNumber, zoom }: { pdf: any; pageNumber: number; zoom: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.75 })
      if (cancelled || !ref.current) return
      const canvas = ref.current
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    })()
    return () => { cancelled = true }
  }, [pdf, pageNumber])
  return <section className="mx-auto w-full max-w-[1000px]">
    <div className="mb-1 text-center text-xs font-bold text-slate-500">Pagina {pageNumber}</div>
    <canvas ref={ref} className="block h-auto max-w-none bg-white shadow-lg" style={{ width: `${zoom * 100}%` }}/>
  </section>
}

function PdfPages({ url, zoom }: { url: string; zoom: number }) {
  const [pdf, setPdf] = useState<any>(null)
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    let loaded: any = null
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        const response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) throw new Error('PDF-ul nu a putut fi deschis.')
        loaded = await pdfjs.getDocument({ data: await response.arrayBuffer() }).promise
        if (!cancelled) { setPdf(loaded); setPageCount(loaded.numPages) }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'PDF indisponibil.')
      }
    })()
    return () => { cancelled = true; loaded?.destroy?.() }
  }, [url])

  if (error) return <div className="m-auto rounded-2xl bg-white p-6 text-center font-semibold text-rose-600 shadow">{error}</div>
  if (!pdf) return <div className="m-auto flex items-center gap-2 rounded-full bg-white px-5 py-3 font-bold text-[#0d5d8b] shadow"><Loader2 className="animate-spin" size={20}/> Se încarcă toate paginile…</div>
  return <div className="space-y-5 pb-8">{Array.from({ length: pageCount }, (_, index) => <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} zoom={zoom}/>)}</div>
}

export function SecurePdfViewerButton({ url, title = 'Document PDF', className = 'btn-secondary inline-flex items-center gap-2', children }: {
  url: string
  title?: string
  className?: string
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const downloadUrl = url + (url.includes('?') ? '&' : '?') + 'download=1'

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape) }
  }, [open])

  return <>
    <button type="button" onClick={() => setOpen(true)} className={className}><FileText size={16}/>{children || 'Deschide PDF'}</button>
    {open && createPortal(<section className="fixed inset-0 z-[160] flex flex-col bg-[#eaf1f6]" role="dialog" aria-modal="true" aria-label={title}>
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 py-2 shadow-sm sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 text-[#082b4d]"><FileText size={20} className="shrink-0 text-[#197fb5]"/><strong className="truncate text-sm sm:text-base">{title}</strong></div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden items-center rounded-xl border border-slate-200 sm:flex"><button type="button" onClick={() => setZoom((value) => Math.max(.75, value - .25))} className="p-2 text-slate-600" aria-label="Micșorează"><Minus size={16}/></button><span className="min-w-12 text-center text-xs font-bold text-slate-600">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(2, value + .25))} className="p-2 text-slate-600" aria-label="Mărește"><Plus size={16}/></button></div>
          <a href={downloadUrl} className="btn-secondary inline-flex items-center gap-2 !px-3 !py-2" title="Descarcă PDF"><Download size={17}/><span className="hidden sm:inline">Descarcă</span></a>
          <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0d5d8b] text-white shadow-sm hover:bg-[#082b4d]" title="Închide documentul" aria-label="Închide documentul"><X size={23}/></button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto p-2 sm:p-4"><PdfPages url={url} zoom={zoom}/></main>
    </section>, document.body)}
  </>
}
