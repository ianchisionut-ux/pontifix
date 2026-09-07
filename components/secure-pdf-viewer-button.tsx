'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileText, X } from 'lucide-react'

export function SecurePdfViewerButton({ url, title = 'Document PDF', className = 'btn-secondary inline-flex items-center gap-2', children }: {
  url: string
  title?: string
  className?: string
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const downloadUrl = `[object Object]${url.includes('?') ? '&' : '?'}download=1`

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
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 shadow-sm sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 text-[#082b4d]"><FileText size={20} className="shrink-0 text-[#197fb5]"/><strong className="truncate text-sm sm:text-base">{title}</strong></div>
        <div className="flex shrink-0 items-center gap-2">
          <a href={downloadUrl} className="btn-secondary inline-flex items-center gap-2 !px-3 !py-2" title="Descarcă PDF"><Download size={17}/><span className="hidden sm:inline">Descarcă</span></a>
          <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0d5d8b] text-white shadow-sm hover:bg-[#082b4d]" title="Închide documentul" aria-label="Închide documentul"><X size={23}/></button>
        </div>
      </header>
      <iframe src={url} title={title} className="min-h-0 w-full flex-1 border-0 bg-white"/>
    </section>, document.body)}
  </>
}
