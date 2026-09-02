'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, FileUp, Loader2, Paperclip, ShieldCheck, X, XCircle } from 'lucide-react'
import type { InternalChatUser } from '@/components/internal-chat/internal-chat-manager'
import { playInternalChatSound } from '@/lib/internal-chat-browser'

type Signal = { id: string; senderId: string; transferId: string; type: 'offer'|'answer'|'ice'|'accept'|'reject'|'cancel'; payload: Record<string, any> }
type FileMeta = { name: string; size: number; type: string }
type TransferStatus = 'incoming'|'waiting'|'connecting'|'transferring'|'completed'|'rejected'|'failed'|'cancelled'
type TransferItem = { id: string; otherUserId: string; direction: 'send'|'receive'; meta: FileMeta; status: TransferStatus; progress: number; downloadUrl?: string; error?: string }
type PeerState = { pc: RTCPeerConnection; otherUserId: string; file?: File; meta: FileMeta; chunks: ArrayBuffer[]; received: number; channel?: RTCDataChannel }

const MAX_FILE_SIZE = 250 * 1024 * 1024
const CHUNK_SIZE = 64 * 1024
const RTC_CONFIG: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function InternalChatFileTransfer({ currentUserId, selectedUserId, users }: {
  currentUserId: string
  selectedUserId: string | null
  users: InternalChatUser[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const peers = useRef(new Map<string, PeerState>())
  const offers = useRef(new Map<string, Signal>())
  const queuedIce = useRef(new Map<string, RTCIceCandidateInit[]>())
  const seenSignals = useRef(new Set<string>())
  const urls = useRef(new Set<string>())
  const cancelledTransfers = useRef(new Set<string>())
  const dragDepth = useRef(0)
  const [transfers, setTransfers] = useState<TransferItem[]>([])
  const [incomingId, setIncomingId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function userName(id: string) {
    return users.find((user) => user.id === id)?.displayName || 'coleg'
  }

  function update(id: string, patch: Partial<TransferItem>) {
    setTransfers((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  async function signal(recipientId: string, transferId: string, type: Signal['type'], payload: Record<string, unknown> = {}) {
    const response = await fetch('/api/internal-chat/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId, transferId, type, payload }),
    })
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Conexiunea P2P nu a putut fi negociată.')
  }

  function makePeer(transferId: string, otherUserId: string, meta: FileMeta, file?: File) {
    const pc = new RTCPeerConnection(RTC_CONFIG)
    const state: PeerState = { pc, otherUserId, file, meta, chunks: [], received: 0 }
    peers.current.set(transferId, state)
    pc.onicecandidate = (event) => {
      if (event.candidate) signal(otherUserId, transferId, 'ice', { candidate: event.candidate.toJSON() }).catch(() => update(transferId, { status: 'failed', error: 'Semnalizarea conexiunii a eșuat.' }))
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && !cancelledTransfers.current.has(transferId)) update(transferId, { status: 'failed', error: 'Conexiunea directă s-a întrerupt.' })
    }
    return state
  }

  async function applyIce(transferId: string, candidate: RTCIceCandidateInit) {
    const state = peers.current.get(transferId)
    if (!state || !state.pc.remoteDescription) {
      queuedIce.current.set(transferId, [...(queuedIce.current.get(transferId) || []), candidate])
      return
    }
    await state.pc.addIceCandidate(candidate).catch(() => undefined)
  }

  async function flushIce(transferId: string) {
    const state = peers.current.get(transferId)
    if (!state) return
    for (const candidate of queuedIce.current.get(transferId) || []) await state.pc.addIceCandidate(candidate).catch(() => undefined)
    queuedIce.current.delete(transferId)
  }

  async function sendFile(transferId: string, channel: RTCDataChannel) {
    const state = peers.current.get(transferId)
    if (!state?.file) return
    const file = state.file
    channel.bufferedAmountLowThreshold = 1024 * 1024
    update(transferId, { status: 'transferring', progress: 0 })
    for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
      if (channel.readyState !== 'open') throw new Error('Canalul direct s-a închis.')
      if (channel.bufferedAmount > 4 * 1024 * 1024) await new Promise<void>((resolve) => channel.addEventListener('bufferedamountlow', () => resolve(), { once: true }))
      const end = Math.min(offset + CHUNK_SIZE, file.size)
      channel.send(await file.slice(offset, end).arrayBuffer())
      update(transferId, { progress: Math.round(end / file.size * 100) })
    }
    channel.send('__ELMONT_FILE_END__')
    update(transferId, { status: 'completed', progress: 100 })
  }

  function setupSender(transferId: string, channel: RTCDataChannel) {
    const state = peers.current.get(transferId)
    if (state) state.channel = channel
    channel.onopen = () => sendFile(transferId, channel).catch((error) => {
      if (!cancelledTransfers.current.has(transferId)) update(transferId, { status: 'failed', error: error instanceof Error ? error.message : 'Transfer eșuat.' })
    })
    channel.onerror = () => update(transferId, { status: 'failed', error: 'Canalul de transfer a întâmpinat o eroare.' })
  }

  function setupReceiver(transferId: string, channel: RTCDataChannel) {
    const state = peers.current.get(transferId)
    if (!state) return
    state.channel = channel
    channel.binaryType = 'arraybuffer'
    channel.onopen = () => update(transferId, { status: 'transferring' })
    channel.onmessage = async (event) => {
      if (event.data === '__ELMONT_FILE_END__') {
        const blob = new Blob(state.chunks, { type: state.meta.type || 'application/octet-stream' })
        const downloadUrl = URL.createObjectURL(blob)
        urls.current.add(downloadUrl)
        state.chunks = []
        update(transferId, { status: 'completed', progress: 100, downloadUrl })
        playInternalChatSound()
        return
      }
      const chunk = event.data instanceof ArrayBuffer ? event.data : await (event.data as Blob).arrayBuffer()
      state.chunks.push(chunk)
      state.received += chunk.byteLength
      update(transferId, { status: 'transferring', progress: Math.min(100, Math.round(state.received / state.meta.size * 100)) })
    }
    channel.onerror = () => update(transferId, { status: 'failed', error: 'Canalul de transfer a întâmpinat o eroare.' })
  }

  async function start(file: File) {
    if (!selectedUserId) return alert('Selectează o conversație directă. Fișierele nu se trimit în canalul general.')
    if (!('RTCPeerConnection' in window)) return alert('Browserul nu permite transfer direct WebRTC.')
    if (file.size > MAX_FILE_SIZE) return alert('Fișierul poate avea maximum 250 MB.')
    if (!file.size) return alert('Fișierul este gol.')
    const id = crypto.randomUUID()
    const meta: FileMeta = { name: file.name, size: file.size, type: file.type }
    setTransfers((current) => [{ id, otherUserId: selectedUserId, direction: 'send', meta, status: 'waiting', progress: 0 } as TransferItem, ...current].slice(0, 8))
    try {
      const state = makePeer(id, selectedUserId, meta, file)
      const channel = state.pc.createDataChannel('elmont-file', { ordered: true })
      setupSender(id, channel)
      const offer = await state.pc.createOffer()
      await state.pc.setLocalDescription(offer)
      await signal(selectedUserId, id, 'offer', { sdp: state.pc.localDescription, meta })
      void fetch('/api/internal-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: selectedUserId, text: `📎 Ai primit o solicitare de transfer P2P: ${file.name} (${formatBytes(file.size)}). Deschide chatul și apasă Acceptă transferul. Fișierul nu este stocat pe server.` }) })
    } catch (error) {
      update(id, { status: 'failed', error: error instanceof Error ? error.message : 'Transferul nu a putut porni.' })
    }
  }

  useEffect(() => {
    function hasFiles(event: DragEvent) { return Array.from(event.dataTransfer?.types || []).includes('Files') }
    function enter(event: DragEvent) { if (!hasFiles(event)) return; event.preventDefault(); dragDepth.current += 1; setDragging(true) }
    function over(event: DragEvent) { if (!hasFiles(event)) return; event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy' }
    function leave(event: DragEvent) { if (!hasFiles(event)) return; event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false) }
    function drop(event: DragEvent) { if (!hasFiles(event)) return; event.preventDefault(); dragDepth.current = 0; setDragging(false); const file = event.dataTransfer?.files?.[0]; if (file) void start(file) }
    window.addEventListener('dragenter', enter); window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragenter', enter); window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }, [selectedUserId])

  async function accept(transferId: string) {
    const offer = offers.current.get(transferId)
    if (!offer) return
    const meta = offer.payload.meta as FileMeta
    setIncomingId(null)
    update(transferId, { status: 'connecting' })
    try {
      const state = makePeer(transferId, offer.senderId, meta)
      state.pc.ondatachannel = (event) => setupReceiver(transferId, event.channel)
      await state.pc.setRemoteDescription(offer.payload.sdp as RTCSessionDescriptionInit)
      await flushIce(transferId)
      const answer = await state.pc.createAnswer()
      await state.pc.setLocalDescription(answer)
      await signal(offer.senderId, transferId, 'answer', { sdp: state.pc.localDescription })
      await signal(offer.senderId, transferId, 'accept')
    } catch (error) {
      update(transferId, { status: 'failed', error: error instanceof Error ? error.message : 'Conexiunea nu a putut fi acceptată.' })
    }
  }

  async function reject(transferId: string) {
    const offer = offers.current.get(transferId)
    setIncomingId(null)
    update(transferId, { status: 'rejected' })
    if (offer) await signal(offer.senderId, transferId, 'reject').catch(() => undefined)
  }

  async function cancelOrDismiss(item: TransferItem) {
    const active = item.status === 'incoming' || item.status === 'waiting' || item.status === 'connecting' || item.status === 'transferring'
    if (active) {
      cancelledTransfers.current.add(item.id)
      setIncomingId((current) => current === item.id ? null : current)
      const state = peers.current.get(item.id)
      state?.channel?.close()
      state?.pc.close()
      peers.current.delete(item.id)
      await signal(item.otherUserId, item.id, 'cancel').catch(() => undefined)
    }
    if (item.downloadUrl) {
      URL.revokeObjectURL(item.downloadUrl)
      urls.current.delete(item.downloadUrl)
    }
    offers.current.delete(item.id)
    queuedIce.current.delete(item.id)
    setTransfers((current) => current.filter((transfer) => transfer.id !== item.id))
  }

  useEffect(() => {
    let stopped = false
    async function poll() {
      try {
        const response = await fetch('/api/internal-chat/signals', { cache: 'no-store' })
        if (!response.ok || stopped) return
        const body = await response.json() as { signals: Signal[] }
        for (const item of body.signals) {
          if (seenSignals.current.has(item.id)) continue
          seenSignals.current.add(item.id)
          if (item.type === 'offer') {
            const meta = item.payload.meta as FileMeta
            if (!meta?.name || !meta?.size) continue
            offers.current.set(item.transferId, item)
            setTransfers((current) => current.some((transfer) => transfer.id === item.transferId) ? current : [{ id: item.transferId, otherUserId: item.senderId, direction: 'receive', meta, status: 'incoming', progress: 0 } as TransferItem, ...current].slice(0, 8))
            setIncomingId(item.transferId)
            playInternalChatSound()
          } else if (item.type === 'accept') {
            setTransfers((current) => current.map((transfer) => transfer.id === item.transferId && transfer.status === 'waiting' ? { ...transfer, status: 'connecting' } : transfer))
          } else if (item.type === 'answer') {
            const state = peers.current.get(item.transferId)
            if (state) {
              await state.pc.setRemoteDescription(item.payload.sdp as RTCSessionDescriptionInit)
              await flushIce(item.transferId)
            }
          } else if (item.type === 'ice' && item.payload.candidate) {
            await applyIce(item.transferId, item.payload.candidate as RTCIceCandidateInit)
          } else if (item.type === 'reject') {
            update(item.transferId, { status: 'rejected', error: 'Destinatarul a refuzat transferul.' })
            peers.current.get(item.transferId)?.pc.close()
          } else if (item.type === 'cancel') {
            cancelledTransfers.current.add(item.transferId)
            setIncomingId((current) => current === item.transferId ? null : current)
            update(item.transferId, { status: 'cancelled' })
            peers.current.get(item.transferId)?.pc.close()
          }
        }
      } catch { /* următoarea verificare reîncearcă */ }
    }
    poll()
    const timer = window.setInterval(poll, 1500)
    return () => {
      stopped = true
      window.clearInterval(timer)
      for (const state of peers.current.values()) state.pc.close()
      for (const url of urls.current) URL.revokeObjectURL(url)
    }
  }, [])

  const incoming = incomingId ? transfers.find((item) => item.id === incomingId) : null
  const statusLabel: Record<TransferStatus, string> = {
    incoming: 'Așteaptă acceptul', waiting: 'Așteaptă acceptarea', connecting: 'Se conectează direct…', transferring: 'Se transferă…',
    completed: 'Finalizat', rejected: 'Refuzat', failed: 'Eșuat', cancelled: 'Anulat',
  }

  return <>
    {dragging && <div className="pointer-events-none fixed inset-3 z-[105] flex items-center justify-center rounded-[30px] border-4 border-dashed border-[#197fb5] bg-[#e8f6fc]/95 shadow-2xl"><div className="text-center text-[#082b4d]"><FileUp size={54} className="mx-auto text-[#197fb5]"/><strong className="mt-4 block text-xl">Trimite fișierul către {selectedUserId ? userName(selectedUserId) : 'un coleg'}</strong><span className="mt-1 block text-sm text-slate-600">Eliberează aici · transfer direct, fără stocare pe server</span></div></div>}
    <div className="border-t border-slate-100 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) start(file); event.currentTarget.value = '' }}/>
        <button type="button" disabled={!selectedUserId} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-[#0d5d8b] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40" title={selectedUserId ? 'Transfer direct, fără stocare pe server' : 'Selectează o conversație directă'}>
          <Paperclip size={15}/> Trimite fișier P2P
        </button>
        <span className="hidden items-center gap-1 text-[10px] font-semibold text-emerald-700 sm:inline-flex"><ShieldCheck size={13}/> Direct între dispozitive · max. 250 MB</span>
      </div>
      {!!transfers.length && <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{transfers.slice(0, 4).map((item) => <div key={item.id} className="min-w-[230px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2"><FileUp size={14} className="shrink-0 text-[#197fb5]"/><strong className="min-w-0 flex-1 truncate text-xs text-[#082b4d]" title={item.meta.name}>{item.meta.name}</strong>{item.status === 'completed' ? <CheckCircle2 size={15} className="text-emerald-600"/> : item.status === 'failed' || item.status === 'rejected' || item.status === 'cancelled' ? <XCircle size={15} className="text-rose-500"/> : <Loader2 size={14} className="animate-spin text-[#197fb5]"/>}<button type="button" onClick={() => void cancelOrDismiss(item)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title={item.status === 'incoming' || item.status === 'waiting' || item.status === 'connecting' || item.status === 'transferring' ? 'Anulează transferul' : 'Elimină din listă'} aria-label={item.status === 'incoming' || item.status === 'waiting' || item.status === 'connecting' || item.status === 'transferring' ? 'Anulează transferul' : 'Elimină din listă'}><X size={14}/></button></div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500"><span>{item.direction === 'send' ? `Către ${userName(item.otherUserId)}` : `De la ${userName(item.otherUserId)}`}</span><span>{statusLabel[item.status]} {item.progress ? `${item.progress}%` : ''}</span></div>
        {(item.status === 'transferring' || item.status === 'connecting') && <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#197fb5]" style={{ width: `${Math.max(item.progress, 4)}%` }}/></div>}
        {item.downloadUrl && <a href={item.downloadUrl} download={item.meta.name} className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-emerald-700"><Download size={12}/> Descarcă fișierul</a>}
        {item.error && <p className="mt-1 text-[10px] font-semibold text-rose-600">{item.error}</p>}
      </div>)}</div>}
    </div>

    {incoming && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-md rounded-[26px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#197fb5]"><FileUp size={23}/></div><button onClick={() => reject(incoming.id)} className="round-action"><X size={17}/></button></div>
        <h2 className="mt-4 text-xl font-black text-[#082b4d]">Fișier de la {userName(incoming.otherUserId)}</h2>
        <p className="mt-2 break-all text-sm font-bold text-slate-700">{incoming.meta.name}</p>
        <p className="mt-1 text-xs text-slate-500">{formatBytes(incoming.meta.size)} · transfer direct, fără salvare pe server</p>
        <div className="mt-6 flex justify-end gap-2"><button onClick={() => reject(incoming.id)} className="btn-secondary">Refuză</button><button onClick={() => accept(incoming.id)} className="btn-primary inline-flex items-center gap-2"><Download size={16}/> Acceptă transferul</button></div>
      </div>
    </div>}
  </>
}
