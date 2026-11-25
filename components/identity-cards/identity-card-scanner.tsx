'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Camera, CameraOff, CreditCard, FileUp, Loader2, RotateCw, Save, ScanLine, ShieldCheck, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { IdentityCardRecord } from '@/lib/identity-card-storage'
import type { IdentityCardData } from '@/lib/browser-identity-card-ocr'
import { useLanguage } from '@/components/language-provider'

const EMPTY: IdentityCardData = { fullName: '', cnp: '', series: '', number: '', domicile: '', issuedBy: '', validFrom: '', validUntil: '' }
const FIELDS: Array<[keyof IdentityCardData, string]> = [
  ['fullName', 'Nume și prenume'], ['cnp', 'CNP'], ['series', 'Serie CI'], ['number', 'Număr CI'],
  ['domicile', 'Domiciliu'], ['issuedBy', 'Emisă de'], ['validFrom', 'Valabilă de la'], ['validUntil', 'Valabilă până la'],
]
type ConnectionOption = { id: string; nib: string; beneficiary: string }
type CropRect = { x: number; y: number; w: number; h: number }
const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 }
const CARD_RATIO = 1.586

function cardFrame(width: number, height: number) {
  const frameWidth = Math.min(width * .9, height * .82 * CARD_RATIO)
  const frameHeight = frameWidth / CARD_RATIO
  return { x: (width - frameWidth) / 2, y: (height - frameHeight) / 2, w: frameWidth, h: frameHeight }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Imaginea nu a putut fi creată.')), type, quality))
}

export function IdentityCardScanner({ records, connections, canEdit, connectionId, embeddedValue, onEmbeddedChange, onEmbeddedSave, embeddedSaving = false, hideSavedRecords = false }: {
  records: IdentityCardRecord[]
  connections: ConnectionOption[]
  canEdit: boolean
  connectionId?: string
  embeddedValue?: IdentityCardData
  onEmbeddedChange?: (data: IdentityCardData) => void
  onEmbeddedSave?: () => void
  embeddedSaving?: boolean
  hideSavedRecords?: boolean
}) {
  const router = useRouter()
  const { tr } = useLanguage()
  const embedded = !!onEmbeddedChange
  const [draft, setDraft] = useState<IdentityCardData>(embeddedValue || EMPTY)
  const visibleDraft = embedded ? (embeddedValue || EMPTY) : draft
  const [selectedConnectionId, setSelectedConnectionId] = useState(connectionId || '')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraAspect, setCameraAspect] = useState(16 / 9)
  const [preview, setPreview] = useState('')
  const [previewAspect, setPreviewAspect] = useState(1)
  const [previewName, setPreviewName] = useState('')
  const [previewPages, setPreviewPages] = useState(1)
  const [crop, setCrop] = useState<CropRect>(FULL_CROP)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const visible = connectionId ? records.filter((record) => record.connectionCaseId === connectionId) : records

  function update(next: IdentityCardData) { setDraft(next); onEmbeddedChange?.(next) }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
  }

  function clearPreview() {
    sourceCanvasRef.current = null
    dragStartRef.current = null
    setPreview('')
    setPreviewAspect(1)
    setPreviewName('')
    setPreviewPages(1)
    setCrop(FULL_CROP)
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play().catch(() => undefined)
  }, [cameraOpen])

  async function startCamera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setNotice('Camera este disponibilă pe conexiune securizată HTTPS și într-un browser modern.')
      return
    }
    setBusy('camera'); setNotice('')
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      setCameraOpen(true)
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      setNotice(name === 'NotAllowedError' ? 'Permite accesul la cameră din browser și încearcă din nou.' : name === 'NotFoundError' ? 'Nu a fost găsită nicio cameră disponibilă.' : 'Camera nu a putut fi pornită.')
    } finally { setBusy('') }
  }

  async function preparePreview(file?: File) {
    if (!file) return
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    const isImage = file.type.startsWith('image/') || /\.(?:jpe?g|jfif|png|webp)$/i.test(file.name)
    if (!isImage && !isPdf) return setNotice('Selectează o imagine sau un PDF scanat.')
    if (file.size > 15 * 1024 * 1024) return setNotice('Fișierul poate avea maximum 15 MB.')
    setBusy('prepare'); setNotice('Pregătesc previzualizarea locală…'); clearPreview()
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Browserul nu poate deschide imaginea.')
      let pages = 1
      if (isPdf) {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
        try {
          const pdf = await loadingTask.promise
          pages = pdf.numPages
          const page = await pdf.getPage(1)
          const pageSize = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: Math.min(3, 2600 / Math.max(pageSize.width, pageSize.height)) })
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvas, canvasContext: context, viewport }).promise
        } finally { await loadingTask.destroy() }
      } else {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
        try {
          const scale = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height))
          canvas.width = Math.max(1, Math.round(bitmap.width * scale))
          canvas.height = Math.max(1, Math.round(bitmap.height * scale))
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        } finally { bitmap.close() }
      }
      sourceCanvasRef.current = canvas
      setPreviewAspect(canvas.width / canvas.height)
      setPreview(canvas.toDataURL('image/jpeg', .88))
      setPreviewName(file.name)
      setPreviewPages(pages)
      setCrop(FULL_CROP)
      setNotice(pages > 1 ? `PDF-ul are ${pages} pagini. Alege zona CI de pe prima pagină, apoi verifică datele extrase.` : 'Trage un dreptunghi peste cartea de identitate, apoi apasă „Citește zona selectată”.')
    } catch (error) {
      clearPreview()
      setNotice(error instanceof Error ? error.message : 'Imaginea nu a putut fi deschisă.')
    } finally { setBusy(''); setDragging(false) }
  }

  function pointerPosition(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return null
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    }
  }

  function startCrop(event: ReactPointerEvent<HTMLDivElement>) {
    const position = pointerPosition(event)
    if (!position) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = position
    setCrop({ x: position.x, y: position.y, w: 0, h: 0 })
  }

  function moveCrop(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current
    const end = pointerPosition(event)
    if (!start || !end) return
    setCrop({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) })
  }

  function stopCrop() {
    if (!dragStartRef.current) return
    dragStartRef.current = null
    setCrop((current) => current.w < .07 || current.h < .07 ? FULL_CROP : current)
  }

  function rotatePreview() {
    const source = sourceCanvasRef.current
    if (!source) return
    const rotated = document.createElement('canvas')
    rotated.width = source.height; rotated.height = source.width
    const context = rotated.getContext('2d')
    if (!context) return
    context.translate(rotated.width, 0)
    context.rotate(Math.PI / 2)
    context.drawImage(source, 0, 0)
    sourceCanvasRef.current = rotated
    setPreviewAspect(rotated.width / rotated.height)
    setPreview(rotated.toDataURL('image/jpeg', .88))
    setCrop(FULL_CROP)
  }

  async function scanSelection() {
    const source = sourceCanvasRef.current
    if (!source || busy) return
    if (crop.w < .07 || crop.h < .07) return setNotice('Selectează o zonă mai mare din document.')
    const x = Math.floor(source.width * crop.x)
    const y = Math.floor(source.height * crop.y)
    const width = Math.max(1, Math.min(source.width - x, Math.ceil(source.width * crop.w)))
    const height = Math.max(1, Math.min(source.height - y, Math.ceil(source.height * crop.h)))
    const selected = document.createElement('canvas')
    selected.width = width; selected.height = height
    selected.getContext('2d')?.drawImage(source, x, y, width, height, 0, 0, width, height)
    setBusy('prepare')
    try {
      const blob = await canvasBlob(selected, 'image/png')
      await scan(new File([blob], `ci-zona-${Date.now()}.png`, { type: 'image/png' }))
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Zona CI nu a putut fi pregătită.') }
    finally { setBusy('') }
  }

  async function captureCamera() {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return setNotice('Camera nu este încă pregătită. Așteaptă o secundă și încearcă din nou.')
    const frame = cardFrame(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(frame.w)
    canvas.height = Math.round(frame.h)
    canvas.getContext('2d', { willReadFrequently: true })?.drawImage(video, frame.x, frame.y, frame.w, frame.h, 0, 0, canvas.width, canvas.height)
    const blob = await canvasBlob(canvas, 'image/jpeg', .96)
    stopCamera()
    await scan(new File([blob], `ci-camera-${Date.now()}.jpg`, { type: 'image/jpeg' }))
  }

  async function scan(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return setNotice('Selectează o imagine sau un PDF scanat.')
    if (file.size > 15 * 1024 * 1024) return setNotice('Fișierul poate avea maximum 15 MB.')
    setBusy('scan'); setNotice('Pornesc citirea locală…')
    try {
      const { analyzeIdentityCardInBrowser } = await import('@/lib/browser-identity-card-ocr')
      const data = await analyzeIdentityCardInBrowser(file, setNotice)
      update(embedded ? { ...visibleDraft, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value.trim())) } as IdentityCardData : data)
      setNotice(embedded ? 'Date extrase. Verifică-le, apoi apasă Salvează în fișa branșamentului.' : 'Date extrase. Verifică și corectează înainte de salvare. Imaginea nu a fost încărcată și nu este păstrată.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'CI nu a putut fi citită.') }
    finally { setBusy(''); setDragging(false) }
  }

  async function save() {
    if (!draft.fullName.trim()) return setNotice('Completează numele titularului.')
    setBusy('save')
    const response = await fetch('/api/identity-cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, connectionCaseId: connectionId || selectedConnectionId || null }) })
    const body = await response.json().catch(() => ({})); setBusy('')
    if (!response.ok) return setNotice(body.error || 'Datele CI nu au putut fi salvate.')
    setDraft(EMPTY); setNotice('Datele CI au fost salvate fără imagine.'); router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Ștergi definitiv aceste date CI?')) return
    const response = await fetch(`/api/identity-cards/${id}`, { method: 'DELETE' })
    if (!response.ok) return alert('Datele CI nu au putut fi șterse.')
    router.refresh()
  }

  async function relink(id: string, nextConnectionId: string) {
    const response = await fetch(`/api/identity-cards/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionCaseId: nextConnectionId || null }) })
    if (!response.ok) return alert('Asocierea nu a putut fi salvată.')
    router.refresh()
  }

  const cameraCrop = cardFrame(cameraAspect, 1)
  return <div className="space-y-5">
    {(canEdit || embedded) && <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CreditCard size={20} className="text-[#197fb5]"/><h2 className="font-bold text-[#082b4d]">Scanner carte de identitate</h2></div><p className="mt-1 max-w-3xl text-sm text-slate-500">OCR local pentru CI scanată. Fișierul nu este încărcat și nu este stocat; se păstrează numai datele verificate.</p></div>{canEdit && <button type="button" onClick={cameraOpen ? stopCamera : startCamera} disabled={!!busy} className="btn-secondary inline-flex items-center gap-2">{busy === 'camera' ? <Loader2 size={17} className="animate-spin"/> : cameraOpen ? <CameraOff size={17}/> : <Camera size={17}/>} {tr(cameraOpen ? 'Închide camera' : 'Deschide camera')}</button>}</div>
      {canEdit && cameraOpen && <div className="mt-4 overflow-hidden rounded-2xl border border-[#8bc8e5] bg-[#061a2b] p-3"><div className="relative mx-auto max-w-4xl overflow-hidden rounded-xl bg-black" style={{ aspectRatio: cameraAspect, width: `min(100%, ${Math.round(cameraAspect * 65)}vh)` }}><video ref={videoRef} autoPlay muted playsInline onLoadedMetadata={(event) => { const video = event.currentTarget; if (video.videoWidth && video.videoHeight) setCameraAspect(video.videoWidth / video.videoHeight) }} className="absolute inset-0 h-full w-full object-cover"/><div className="pointer-events-none absolute rounded-xl border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,.34)]" style={{ left: `${cameraCrop.x / cameraAspect * 100}%`, top: `${cameraCrop.y * 100}%`, width: `${cameraCrop.w / cameraAspect * 100}%`, height: `${cameraCrop.h * 100}%` }}><span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white sm:text-xs">{tr('Așază cartea de identitate în chenar')}</span></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold text-blue-100">Ține documentul drept, fără reflexii și cu toate marginile vizibile.</p><button type="button" onClick={captureCamera} className="btn-primary inline-flex items-center gap-2 !bg-[#197fb5]"><ScanLine size={17}/> {tr('Fotografiază și citește')}</button></div></div>}
      {canEdit && !cameraOpen && <><label onDragEnter={(event)=>{event.preventDefault();setDragging(true)}} onDragOver={(event)=>event.preventDefault()} onDragLeave={()=>setDragging(false)} onDrop={(event)=>{event.preventDefault();setDragging(false);void preparePreview(event.dataTransfer.files?.[0])}} className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-7 text-center transition ${dragging ? 'border-[#197fb5] bg-[#e8f6fc]' : 'border-[#8bc8e5] bg-[#f4fbfe] hover:bg-[#edf8fd]'}`}>
        {busy === 'prepare' ? <Loader2 size={28} className="animate-spin text-[#197fb5]"/> : <FileUp size={28} className="text-[#197fb5]"/>}<b className="mt-2 text-sm text-[#082b4d]">{busy === 'prepare' ? 'Se pregătește previzualizarea…' : 'Trage CI aici sau apasă pentru selectare'}</b><span className="mt-1 text-xs text-slate-500">Imagine sau PDF scanat · maximum 15 MB</span><input type="file" accept="image/*,application/pdf,.pdf" className="hidden" disabled={!!busy} onChange={(event) => { void preparePreview(event.target.files?.[0]); event.currentTarget.value = '' }}/>
      </label><label className="btn-secondary mt-3 inline-flex cursor-pointer items-center gap-2 sm:hidden"><Camera size={16}/> Fotografiază și selectează zona<input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!busy} onChange={(event) => { void preparePreview(event.target.files?.[0]); event.currentTarget.value = '' }}/></label></>}
      {canEdit && preview && !cameraOpen && <div className="mt-4 rounded-2xl border border-[#8bc8e5] bg-[#f4fbfe] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-bold text-[#082b4d]">{previewName}</p><p className="text-xs text-slate-600">Trage peste cartea de identitate pentru a selecta doar zona care trebuie citită.{previewPages > 1 ? ' Este afișată prima pagină a PDF-ului.' : ''}</p></div><button type="button" onClick={clearPreview} disabled={!!busy} className="btn-secondary inline-flex items-center gap-1 !px-3 !py-2 text-xs"><X size={14}/> Elimină</button></div>
        <div className="mt-3 flex justify-center overflow-auto rounded-xl bg-slate-800 p-2"><div className="relative cursor-crosshair overflow-hidden rounded-lg" onPointerDown={startCrop} onPointerMove={moveCrop} onPointerUp={stopCrop} onPointerCancel={stopCrop} style={{ touchAction: 'none', width: `min(100%, ${previewAspect * 62}vh)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Previzualizare CI pentru selectarea zonei" draggable={false} className="block w-full select-none"/>
          <span className="pointer-events-none absolute rounded border-[3px] border-sky-400 shadow-[0_0_0_9999px_rgba(0,0,0,.38)]" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}/>
        </div></div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={rotatePreview} disabled={!!busy} className="btn-secondary inline-flex items-center gap-1 !px-3 !py-2 text-xs"><RotateCw size={14}/> Rotește 90°</button><button type="button" onClick={() => setCrop(FULL_CROP)} disabled={!!busy} className="btn-secondary !px-3 !py-2 text-xs">Tot cadrul</button><button type="button" onClick={() => void scanSelection()} disabled={!!busy} className="btn-primary inline-flex items-center gap-2 !px-4 !py-2 text-sm">{busy === 'scan' ? <Loader2 size={16} className="animate-spin"/> : <ScanLine size={16}/>} Citește zona selectată</button></div>
      </div>}
      {notice && <p className={`mt-4 rounded-xl px-3 py-2 text-sm font-semibold ${notice.includes('nu ') || notice.includes('maximum') ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>{notice}</p>}
      {busy === 'scan' && <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#197fb5]"/></div>}
      <div className="mt-5 grid gap-3 md:grid-cols-2">{FIELDS.map(([field, label]) => <label key={field} className={`text-xs font-bold text-slate-500 ${field === 'domicile' ? 'md:col-span-2' : ''}`}>{label}<input disabled={!canEdit} value={visibleDraft[field]} onChange={(event) => update({ ...visibleDraft, [field]: event.target.value })} className="input-field mt-1.5 w-full bg-white disabled:bg-slate-50 disabled:text-slate-700"/></label>)}</div>
      {!embedded && !connectionId && <label className="mt-4 block text-xs font-bold text-slate-500">Asociază opțional cu branșamentul<select value={selectedConnectionId} onChange={(event) => setSelectedConnectionId(event.target.value)} className="input-field mt-1.5 w-full bg-white"><option value="">Fără branșament</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.nib} - {connection.beneficiary || 'Beneficiar necompletat'}</option>)}</select></label>}
      <div className="mt-5 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><ShieldCheck size={15}/> Nu se păstrează poza sau PDF-ul.</span>{embedded ? canEdit && onEmbeddedSave ? <button type="button" onClick={onEmbeddedSave} disabled={embeddedSaving || !!busy} className="btn-primary inline-flex items-center gap-2">{embeddedSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvează în fișa branșamentului</button> : <span className="text-xs font-bold text-[#0d5d8b]">Date CI din fișa branșamentului.</span> : <button onClick={save} disabled={!!busy || !draft.fullName.trim()} className="btn-primary inline-flex items-center gap-2">{busy === 'save' ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvează datele</button>}</div>
    </section>}

    {!hideSavedRecords && <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><CreditCard size={18} className="text-[#197fb5]"/><h2 className="font-bold text-[#082b4d]">Date CI salvate</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{visible.length}</span></div>
      {visible.length ? <div className="grid gap-3 xl:grid-cols-2">{visible.map((record) => <article key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-[#082b4d]">{record.fullName}</h3><p className="mt-1 text-xs text-slate-400">Salvat {new Date(record.createdAt).toLocaleString('ro-RO')}</p></div>{canEdit && <button onClick={() => remove(record.id)} className="round-action !text-red-600" title="Șterge datele CI"><Trash2 size={15}/></button>}</div><dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2"><div><dt className="text-[11px] font-bold text-slate-400">CNP</dt><dd className="font-semibold text-slate-700">{record.cnp || '—'}</dd></div><div><dt className="text-[11px] font-bold text-slate-400">Serie / număr</dt><dd className="font-semibold text-slate-700">{[record.series, record.number].filter(Boolean).join(' ') || '—'}</dd></div><div className="sm:col-span-2"><dt className="text-[11px] font-bold text-slate-400">Domiciliu</dt><dd className="font-semibold text-slate-700">{record.domicile || '—'}</dd></div><div><dt className="text-[11px] font-bold text-slate-400">Emisă de</dt><dd className="font-semibold text-slate-700">{record.issuedBy || '—'}</dd></div><div><dt className="text-[11px] font-bold text-slate-400">Valabilitate</dt><dd className="font-semibold text-slate-700">{[record.validFrom, record.validUntil].filter(Boolean).join(' - ') || '—'}</dd></div></dl>{canEdit && !connectionId && <label className="mt-4 block text-[11px] font-bold text-slate-400">Branșament asociat<select value={record.connectionCaseId || ''} onChange={(event) => relink(record.id, event.target.value)} className="input-field mt-1 w-full bg-white text-sm"><option value="">Fără branșament</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.nib} - {connection.beneficiary}</option>)}</select></label>}</article>)}</div> : <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Nu există date CI pentru această secțiune.</p>}
    </section>}
  </div>
}
