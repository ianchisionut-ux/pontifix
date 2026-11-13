'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, MessageSquareText, RefreshCw, Save, Send, ShieldCheck, Smartphone } from 'lucide-react'

type Config = { senderNumber: string; configured: boolean; username: string; deviceId: string; simNumber: number; enabled: boolean }
type Device = { id: string; name?: string; lastSeen?: string; state?: string }
type Sms = { id: string; nib: string; beneficiary: string; recipient: string; message: string; state: string; error: string | null; createdAt: string }
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const stateLabel: Record<string, string> = {
  Submitting: 'Se pregătește', Pending: 'În așteptare', Processed: 'Preluat de telefon', Sent: 'Trimis de telefon', Delivered: 'Livrat', Failed: 'Eroare', Unknown: 'Stare necunoscută', Cancelled: 'Anulat',
}

export function SmsGatewayDashboard() {
  const [config, setConfig] = useState<Config | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [simNumber, setSimNumber] = useState(1)
  const [enabled, setEnabled] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [messages, setMessages] = useState<Sms[]>([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)

  const refreshMessages = useCallback(async () => {
    const response = await fetch('/api/sms/messages', { cache: 'no-store' })
    if (response.ok) setMessages(await response.json())
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sms-sw.js', { scope: '/sms' }).catch(() => undefined)
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    fetch('/api/sms/config', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Configurarea nu a putut fi încărcată.')
      const data: Config = await response.json()
      setConfig(data); setUsername(data.username); setDeviceId(data.deviceId); setSimNumber(data.simNumber); setEnabled(data.enabled)
    }).catch((caught) => setError(caught.message))
    refreshMessages().catch(() => undefined)
    const timer = window.setInterval(() => refreshMessages().catch(() => undefined), 15000)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.clearInterval(timer) }
  }, [refreshMessages])

  async function save() {
    setBusy('save'); setError(''); setNotice('')
    try {
      const response = await fetch('/api/sms/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: password || undefined, deviceId, simNumber, enabled }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Configurarea nu a putut fi salvată.')
      setPassword('')
      setConfig({ senderNumber: '+40727700062', configured: true, username, deviceId, simNumber, enabled })
      setNotice(enabled ? 'Gateway-ul SMS este activ pentru telefonul selectat.' : 'Datele contului au fost salvate. Caută telefonul, selectează-l și activează gateway-ul.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Eroare la salvare.') }
    finally { setBusy('') }
  }

  async function discoverDevices() {
    setBusy('devices'); setError(''); setNotice('')
    try {
      const response = await fetch('/api/sms/devices', { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Telefoanele nu au putut fi încărcate.')
      setDevices(body)
      setNotice(body.length ? 'Selectează telefonul cu SIM-ul +40 727 700 062.' : 'Nu există telefoane conectate. Pornește serviciul Cloud Server în aplicația Android.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Eroare la căutarea telefoanelor.') }
    finally { setBusy('') }
  }

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  return <main className="min-h-dvh bg-[#eef6fb] px-4 pb-10 pt-6 text-[#082b4d] sm:px-6">
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0d5d8b] text-white"><MessageSquareText size={29}/></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#197fb5]">Aplicație separată Elmont</p><h1 className="text-2xl font-black sm:text-3xl">Gateway SMS</h1></div></div>
        <div className="flex flex-wrap gap-2">{installPrompt && <button type="button" onClick={install} className="btn-primary inline-flex items-center gap-2"><Download size={17}/> Instalează PWA</button>}<a href="https://elmont.ro/dashboard/bransamente" className="btn-secondary">Branșamente</a></div>
      </header>

      <section className="mt-5 rounded-[24px] bg-[#0c3152] p-6 text-white shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#8bc8e5]">Număr expeditor</p><p className="mt-2 text-3xl font-black">{config?.senderNumber || '+40 727 700 062'}</p><p className="mt-2 text-sm text-blue-100/80">SMS-urile sunt trimise de telefonul Android prin SIM-ul selectat.</p></div><span className={`rounded-full px-4 py-2 text-sm font-bold ${config?.enabled ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/15 text-white'}`}>{config?.enabled ? 'Configurat' : 'Configurare necesară'}</span></div>
      </section>

      <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3"><Smartphone className="text-[#197fb5]"/><h2 className="text-xl font-black">Conectează telefonul</h2></div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>Instalează aplicația Android <a className="font-bold text-[#0d5d8b] underline" href="https://github.com/capcom6/android-sms-gateway/releases/latest" target="_blank" rel="noopener noreferrer">SMS Gateway for Android</a> pe telefonul cu SIM-ul +40 727 700 062. Acordă permisiunea de trimitere SMS.</li>
          <li>În aplicație activează <strong>Cloud Server</strong> și pornește serviciul. Copiază numele de utilizator și parola afișate în secțiunea Cloud Server.</li>
          <li>Salvează contul aici, caută telefonul, selectează-l și alege slotul SIM corect. Activează gateway-ul după verificarea numărului pe telefon.</li>
        </ol>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Utilizator gateway<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" className="input-field mt-1.5 w-full" placeholder="Din aplicația Android"/></label>
          <label className="text-sm font-bold">Parolă gateway<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="input-field mt-1.5 w-full" placeholder={config?.configured ? 'Lasă gol pentru a păstra parola' : 'Din aplicația Android'}/></label>
          <label className="text-sm font-bold">Telefon Android<select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} className="input-field mt-1.5 w-full bg-white"><option value="">Selectează telefonul</option>{deviceId && !devices.some((device) => device.id === deviceId) && <option value={deviceId}>Telefon salvat · {deviceId}</option>}{devices.map((device) => <option key={device.id} value={device.id}>{device.name || 'Telefon Android'} · {device.id}</option>)}</select></label>
          <label className="text-sm font-bold">Slot SIM<select value={simNumber} onChange={(event) => setSimNumber(Number(event.target.value))} className="input-field mt-1.5 w-full bg-white"><option value={1}>SIM 1</option><option value={2}>SIM 2</option></select></label>
        </div>
        <label className="mt-5 flex items-center gap-3 rounded-xl bg-[#edf7fc] p-4 text-sm font-bold"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-5 w-5"/> Activează trimiterea SMS din Elmont</label>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={save} disabled={!!busy || !username.trim()} className="btn-primary inline-flex items-center gap-2">{busy === 'save' ? <Loader2 size={17} className="animate-spin"/> : <Save size={17}/>} Salvează</button><button type="button" onClick={discoverDevices} disabled={!!busy || !config?.configured} className="btn-secondary inline-flex items-center gap-2">{busy === 'devices' ? <Loader2 size={17} className="animate-spin"/> : <RefreshCw size={17}/>} Caută telefonul</button></div>
        {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="shrink-0"/> Parola este păstrată criptat în Elmont. Numărul destinatarului și textul mesajului trec prin serverul cloud SMS Gateway for Android pentru a ajunge la telefon.</p>
      </section>

      <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Mesaje trimise din Branșamente</h2><p className="mt-1 text-sm text-slate-500">„În așteptare” înseamnă că mesajul a intrat în coadă; verifică „Trimis” sau „Livrat”.</p></div><button type="button" onClick={() => refreshMessages().catch(() => setError('Nu am putut actualiza mesajele.'))} className="btn-secondary inline-flex items-center gap-2"><RefreshCw size={16}/> Actualizează</button></div>
        <div className="mt-5 space-y-3">{messages.length ? messages.map((sms) => <article key={sms.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{sms.beneficiary || sms.nib}</strong><p className="text-xs text-slate-500">{sms.nib} · {sms.recipient} · {new Date(sms.createdAt).toLocaleString('ro-RO')}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${sms.state === 'Delivered' || sms.state === 'Sent' ? 'bg-emerald-50 text-emerald-700' : sms.state === 'Failed' || sms.state === 'Unknown' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{stateLabel[sms.state] || sms.state}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{sms.message}</p>{sms.error && <p className="mt-2 text-xs text-rose-700">{sms.error}</p>}</article>) : <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500"><Send size={26} className="mx-auto mb-3"/>Nu există încă SMS-uri trimise din Elmont.</div>}</div>
      </section>
    </div>
  </main>
}
