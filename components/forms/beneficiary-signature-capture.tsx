'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Eraser, Loader2, PenLine, Trash2, X } from 'lucide-react'

export function BeneficiarySignatureCapture({ connectionId, beneficiary, onClose, onSaved }: {
  connectionId: string; beneficiary: string; onClose: () => void; onSaved: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(false)
  const [existing, setExisting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const target = canvas.current
    if (!target) return
    target.width = 900
    target.height = 300
    const context = target.getContext('2d')!
    context.strokeStyle = '#1648b0'
    context.lineWidth = 4
    context.lineCap = 'round'
    context.lineJoin = 'round'
    let cancelled = false
    fetch(`/api/formulare/beneficiary-signature/${encodeURIComponent(connectionId)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 404) return
        if (!response.ok) throw new Error('Semnătura existentă nu a putut fi încărcată.')
        const blob = await response.blob()
        const bitmap = await createImageBitmap(blob)
        if (!cancelled) { context.drawImage(bitmap, 0, 0, target.width, target.height); setHasInk(true); setExisting(true) }
        bitmap.close()
      }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Semnătura nu a putut fi încărcată.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [connectionId])

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - box.left) * 900 / box.width, y: (event.clientY - box.top) * 300 / box.height }
  }

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (loading) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    const current = point(event)
    lastPoint.current = current
    const context = canvas.current?.getContext('2d')
    if (context) { context.beginPath(); context.arc(current.x, current.y, 2, 0, Math.PI * 2); context.fillStyle = '#1648b0'; context.fill() }
    setHasInk(true)
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !lastPoint.current) return
    event.preventDefault()
    const current = point(event)
    const context = canvas.current?.getContext('2d')
    if (context) {
      context.beginPath()
      context.moveTo(lastPoint.current.x, lastPoint.current.y)
      context.lineTo(current.x, current.y)
      context.stroke()
    }
    lastPoint.current = current
  }

  function pointerUp() { drawing.current = false; lastPoint.current = null }

  function clear() {
    canvas.current?.getContext('2d')?.clearRect(0, 0, 900, 300)
    setHasInk(false)
    setError('')
  }

  async function save() {
    if (!hasInk || !canvas.current) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/formulare/beneficiary-signature/${encodeURIComponent(connectionId)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: canvas.current.toDataURL('image/png'), consentConfirmed: consent }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Semnătura nu a putut fi salvată.')
      onSaved(); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Semnătura nu a putut fi salvată.') }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!window.confirm(`Ștergi semnătura salvată pentru ${beneficiary}?`)) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/formulare/beneficiary-signature/${encodeURIComponent(connectionId)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Semnătura nu a putut fi ștearsă.')
      onSaved(); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Semnătura nu a putut fi ștearsă.') }
    finally { setBusy(false) }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
    <div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#1648b0]"><PenLine size={24}/></div>
        <div className="min-w-0 flex-1"><h2 className="text-xl font-extrabold text-[#082b4d]">Semnătura beneficiarului</h2><p className="mt-1 text-sm text-slate-600">{beneficiary}. Beneficiarul semnează direct pe ecran, apoi tu alegi unde apare semnătura în fiecare PDF.</p></div>
        <button type="button" className="round-action" onClick={onClose} aria-label="Închide"><X size={18}/></button>
      </div>
      <div className="mt-5 rounded-2xl border-2 border-dashed border-blue-300 bg-white p-1">
        <canvas ref={canvas} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} className={`block h-[190px] w-full touch-none rounded-xl sm:h-[260px] ${loading ? 'pointer-events-none opacity-40' : ''}`} aria-label="Zona de semnare a beneficiarului"/>
      </div>
      <p className="mt-2 text-xs text-slate-500">Semnătura albastră se păstrează numai pentru acest branșament. Nu este aplicată automat pe documente fără o poziție configurată.</p>
      <label className="mt-4 flex items-start gap-3 rounded-xl bg-blue-50 p-3 text-sm font-medium text-[#082b4d]"><input type="checkbox" className="mt-1" checked={consent} onChange={(event) => setConsent(event.target.checked)}/> Confirm că beneficiarul a fost informat și a acceptat folosirea semnăturii desenate pentru documentele acestui branșament.</label>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {existing && <button type="button" className="btn-secondary mr-auto inline-flex items-center gap-2 !text-red-600" disabled={busy} onClick={remove}><Trash2 size={16}/> Șterge semnătura</button>}
        <button type="button" className="btn-secondary inline-flex items-center gap-2" disabled={busy || !hasInk} onClick={clear}><Eraser size={16}/> Șterge desenul</button>
        <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={loading || busy || !hasInk || !consent} onClick={save}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} Salvează semnătura</button>
      </div>
    </div>
  </div>
}
