'use client'

import { useRef, useState } from 'react'
import { uploadPresigned } from '@vercel/blob/client'
import { FileUp, Loader2 } from 'lucide-react'
import type { BrowserAtrResult } from '@/lib/browser-atr-ocr'

export function InternalAtrUpload() {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  async function choose(file?: File) {
    if (!file) return
    if (file.type !== 'application/pdf') return alert('ATR-ul trebuie să fie un fișier PDF.')
    if (file.size > 10 * 1024 * 1024) return alert('Fișierul ATR poate avea maximum 10 MB.')
    setBusy(true)
    setStatus('Citesc ATR-ul…')
    try {
      let atrOcr: BrowserAtrResult | null = null
      try {
        const { analyzeAtrInBrowser } = await import('@/lib/browser-atr-ocr')
        atrOcr = await analyzeAtrInBrowser(file, setStatus)
      } catch {
        setStatus('Salvez documentul…')
      }

      const blob = await uploadPresigned(`cereri-oferta/${crypto.randomUUID()}/${file.name}`, file, {
        access: 'private',
        handleUploadUrl: '/api/public/quote-upload',
      })
      setStatus('Creez cererea de ofertă…')
      const response = await fetch('/api/offers/import-atr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atrPathname: blob.pathname, atrName: file.name, atrOcr }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Cererea nu a putut fi creată.')
      window.location.reload()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ATR-ul nu a putut fi importat.')
      setBusy(false)
      setStatus('')
      if (input.current) input.current.value = ''
    }
  }

  return <>
    <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => choose(event.target.files?.[0])}/>
    <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn-primary inline-flex items-center gap-2">
      {busy ? <Loader2 size={17} className="animate-spin"/> : <FileUp size={17}/>}
      {busy ? status || 'Se procesează…' : 'Încarcă ATR'}
    </button>
  </>
}
