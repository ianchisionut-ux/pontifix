'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, CreditCard, FileUp, Loader2, Save, ScanLine, ShieldCheck, Trash2 } from 'lucide-react'
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

export function IdentityCardScanner({ records, connections, canEdit, connectionId, embeddedValue, onEmbeddedChange, hideSavedRecords = false }: {
  records: IdentityCardRecord[]
  connections: ConnectionOption[]
  canEdit: boolean
  connectionId?: string
  embeddedValue?: IdentityCardData
  onEmbeddedChange?: (data: IdentityCardData) => void
  hideSavedRecords?: boolean
}) {
  const router = useRouter()
  const { tr } = useLanguage()
  const embedded = !!onEmbeddedChange
  const [draft, setDraft] = useState<IdentityCardData>(embeddedValue || EMPTY)
  const [selectedConnectionId, setSelectedConnectionId] = useState(connectionId || '')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const visible = connectionId ? records.filter((record) => record.connectionCaseId === connectionId) : records

  useEffect(() => { if (embeddedValue) setDraft(embeddedValue) }, [embeddedValue])

  function update(next: IdentityCardData) { setDraft(next); onEmbeddedChange?.(next) }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
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

  async function captureCamera() {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return setNotice('Camera nu este încă pregătită. Așteaptă o secundă și încearcă din nou.')
    const cardRatio = 1.586
    let sourceWidth = video.videoWidth * .9
    let sourceHeight = sourceWidth / cardRatio
    if (sourceHeight > video.videoHeight * .82) {
      sourceHeight = video.videoHeight * .82
      sourceWidth = sourceHeight * cardRatio
    }
    const sourceX = (video.videoWidth - sourceWidth) / 2
    const sourceY = (video.videoHeight - sourceHeight) / 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(sourceWidth)
    canvas.height = Math.round(sourceHeight)
    canvas.getContext('2d', { willReadFrequently: true })?.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Fotografia nu a putut fi creată.')), 'image/jpeg', .96))
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
      update(data)
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

  return <div className="space-y-5">
    {(canEdit || embedded) && <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CreditCard size={20} className="text-[#197fb5]"/><h2 className="font-bold text-[#082b4d]">Scanner carte de identitate</h2></div><p className="mt-1 max-w-3xl text-sm text-slate-500">OCR local pentru CI scanată. Fișierul nu este încărcat și nu este stocat; se păstrează numai datele verificate.</p></div>{canEdit && <button type="button" onClick={cameraOpen ? stopCamera : startCamera} disabled={!!busy} className="btn-secondary inline-flex items-center gap-2">{busy === 'camera' ? <Loader2 size={17} className="animate-spin"/> : cameraOpen ? <CameraOff size={17}/> : <Camera size={17}/>} {tr(cameraOpen ? 'Închide camera' : 'Deschide camera')}</button>}</div>
      {canEdit && cameraOpen && <div className="mt-4 overflow-hidden rounded-2xl border border-[#8bc8e5] bg-[#061a2b] p-3"><div className="relative mx-auto max-w-4xl overflow-hidden rounded-xl bg-black"><video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover"/><div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="aspect-[1.586/1] w-[90%] rounded-xl border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,.34)]"><span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/65 px-3 py-1.5 text-xs font-bold text-white">{tr('Așază cartea de identitate în chenar')}</span></div></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold text-blue-100">Ține documentul drept, fără reflexii și cu toate marginile vizibile.</p><button type="button" onClick={captureCamera} className="btn-primary inline-flex items-center gap-2 !bg-[#197fb5]"><ScanLine size={17}/> {tr('Fotografiază și citește')}</button></div></div>}
      {canEdit && !cameraOpen && <label onDragEnter={(event)=>{event.preventDefault();setDragging(true)}} onDragOver={(event)=>event.preventDefault()} onDragLeave={()=>setDragging(false)} onDrop={(event)=>{event.preventDefault();setDragging(false);scan(event.dataTransfer.files?.[0])}} className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-7 text-center transition ${dragging ? 'border-[#197fb5] bg-[#e8f6fc]' : 'border-[#8bc8e5] bg-[#f4fbfe] hover:bg-[#edf8fd]'}`}>
        {busy === 'scan' ? <Loader2 size={28} className="animate-spin text-[#197fb5]"/> : <FileUp size={28} className="text-[#197fb5]"/>}<b className="mt-2 text-sm text-[#082b4d]">{busy === 'scan' ? 'Se citește CI…' : 'Trage CI aici sau apasă pentru selectare'}</b><span className="mt-1 text-xs text-slate-500">Imagine sau PDF scanat · maximum 15 MB</span><input type="file" accept="image/*,application/pdf,.pdf" className="hidden" disabled={!!busy} onChange={(event) => { scan(event.target.files?.[0]); event.currentTarget.value = '' }}/>
      </label>}
      {notice && <p className={`mt-4 rounded-xl px-3 py-2 text-sm font-semibold ${notice.includes('nu ') || notice.includes('maximum') ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>{notice}</p>}
      {busy === 'scan' && <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#197fb5]"/></div>}
      <div className="mt-5 grid gap-3 md:grid-cols-2">{FIELDS.map(([field, label]) => <label key={field} className={`text-xs font-bold text-slate-500 ${field === 'domicile' ? 'md:col-span-2' : ''}`}>{label}<input disabled={!canEdit} value={draft[field]} onChange={(event) => update({ ...draft, [field]: event.target.value })} className="input-field mt-1.5 w-full bg-white disabled:bg-slate-50 disabled:text-slate-700"/></label>)}</div>
      {!embedded && !connectionId && <label className="mt-4 block text-xs font-bold text-slate-500">Asociază opțional cu branșamentul<select value={selectedConnectionId} onChange={(event) => setSelectedConnectionId(event.target.value)} className="input-field mt-1.5 w-full bg-white"><option value="">Fără branșament</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.nib} - {connection.beneficiary || 'Beneficiar necompletat'}</option>)}</select></label>}
      <div className="mt-5 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><ShieldCheck size={15}/> Nu se păstrează poza sau PDF-ul.</span>{embedded ? <span className="text-xs font-bold text-[#0d5d8b]">{canEdit ? 'Se salvează odată cu branșamentul.' : 'Date salvate în fișa branșamentului.'}</span> : <button onClick={save} disabled={!!busy || !draft.fullName.trim()} className="btn-primary inline-flex items-center gap-2">{busy === 'save' ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvează datele</button>}</div>
    </section>}

    {!hideSavedRecords && <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><CreditCard size={18} className="text-[#197fb5]"/><h2 className="font-bold text-[#082b4d]">Date CI salvate</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{visible.length}</span></div>
      {visible.length ? <div className="grid gap-3 xl:grid-cols-2">{visible.map((record) => <article key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-[#082b4d]">{record.fullName}</h3><p className="mt-1 text-xs text-slate-400">Salvat {new Date(record.createdAt).toLocaleString('ro-RO')}</p></div>{canEdit && <button onClick={() => remove(record.id)} className="round-action !text-red-600" title="Șterge datele CI"><Trash2 size={15}/></button>}</div><dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2"><div><dt className="text-[11px] font-bold text-slate-400">CNP</dt><dd className="font-semibold text-slate-700">{record.cnp || '—'}</dd></div><div><dt className="text-[11px] font-bold text-slate-400">Serie / număr</dt><dd className="font-semibold text-slate-700">{[record.series, record.number].filter(Boolean).join(' ') || '—'}</dd></div><div className="sm:col-span-2"><dt className="text-[11px] font-bold text-slate-400">Domiciliu</dt><dd className="font-semibold text-slate-700">{record.domicile || '—'}</dd></div><div><dt className="text-[11px] font-bold text-slate-400">Emisă de</dt><dd className="font-semibold text-slate-700">{record.issuedBy || '—'}</dd></div><div><dt className="text-[11px] font-bold text-slate-400">Valabilitate</dt><dd className="font-semibold text-slate-700">{[record.validFrom, record.validUntil].filter(Boolean).join(' - ') || '—'}</dd></div></dl>{canEdit && !connectionId && <label className="mt-4 block text-[11px] font-bold text-slate-400">Branșament asociat<select value={record.connectionCaseId || ''} onChange={(event) => relink(record.id, event.target.value)} className="input-field mt-1 w-full bg-white text-sm"><option value="">Fără branșament</option>{connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.nib} - {connection.beneficiary}</option>)}</select></label>}</article>)}</div> : <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Nu există date CI pentru această secțiune.</p>}
    </section>}
  </div>
}