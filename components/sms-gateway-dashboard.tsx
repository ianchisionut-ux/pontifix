'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Download, MessageSquareText, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'

type Config = { senderNumber: string; paired: boolean; enabled: boolean; lastSeenAt: string | null; online: boolean }
type SmsRow = { id: string; nib: string; beneficiary: string; recipient: string; message: string; state: string; error: string | null; createdAt: string }

export function SmsGatewayDashboard() {
  const [config, setConfig] = useState<Config | null>(null)
  const [messages, setMessages] = useState<SmsRow[]>([])
  const [pairingToken, setPairingToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    const [configResponse, messagesResponse] = await Promise.all([
      fetch('/api/sms/config', { cache: 'no-store' }),
      fetch('/api/sms/messages', { cache: 'no-store' }),
    ])
    if (!configResponse.ok) throw new Error('Nu am putut încărca starea gateway-ului.')
    setConfig(await configResponse.json())
    if (messagesResponse.ok) setMessages(await messagesResponse.json())
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sms-sw.js', { scope: '/sms' }).catch(() => undefined)
    refresh().catch((caught) => setError(caught.message))
    const timer = window.setInterval(() => refresh().catch(() => undefined), 15000)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function pair() {
    if (config?.paired && !window.confirm('Codul nou va deconecta telefonul asociat acum. Continui?')) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/sms/pair', { method: 'POST' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Asocierea a eșuat.')
      setPairingToken(body.token)
      setNotice('Copiază codul în aplicația Android. Codul este afișat o singură dată.')
      await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Asocierea a eșuat.') }
    finally { setBusy(false) }
  }

  async function stop() {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/sms/pair', { method: 'DELETE' })
      if (!response.ok) throw new Error('Nu am putut opri gateway-ul.')
      setPairingToken('')
      setNotice('Trimiterea SMS este oprită. Pentru repornire, generează un cod nou.')
      await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Operația a eșuat.') }
    finally { setBusy(false) }
  }

  return <main className="min-h-dvh bg-[#eef6fb] px-3 pb-10 pt-4 text-[#082b4d] sm:px-6 sm:pt-6">
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0d5d8b] text-white"><MessageSquareText size={29}/></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#197fb5]">Aplicație separată Elmont</p><h1 className="text-2xl font-black sm:text-3xl">Gateway SMS</h1></div></div>
        <a href="https://elmont.ro/dashboard/bransamente" className="btn-secondary">Branșamente</a>
      </header>

      <section className="rounded-[24px] bg-[#0c3152] p-6 text-white shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[#8bc8e5]">Număr expeditor</p>
        <p className="mt-2 text-3xl font-black">{config?.senderNumber || '+40 727 700 062'}</p>
        <p className="mt-2 text-sm text-blue-100/80">SMS-urile pleacă direct de pe cartela SIM a telefonului Android asociat.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3"><span className={`rounded-full px-4 py-2 text-sm font-bold ${config?.online ? 'bg-emerald-400/25 text-emerald-100' : 'bg-white/15 text-white'}`}>{config?.online ? 'Telefon conectat' : config?.paired && config.enabled ? 'Telefon offline' : config?.paired ? 'Oprit' : 'Neasociat'}</span>{config?.lastSeenAt && <span className="text-xs text-blue-100/80">Ultima conectare: {new Date(config.lastSeenAt).toLocaleString('ro-RO')}</span>}</div>
      </section>

      <section className="rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3"><Smartphone className="text-[#197fb5]"/><h2 className="text-xl font-black">Conectează telefonul</h2></div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li><a className="font-bold text-[#0d5d8b] underline" href="/downloads/elmont-sms-gateway.apk" download>Descarcă APK-ul Elmont SMS</a> pe telefonul cu SIM-ul +40 727 700 062 și instalează-l.</li>
          <li>Apasă <strong>Generează cod de asociere</strong>, copiază codul și lipește-l în aplicația Android.</li>
          <li>Pe Android, alege acest SIM ca implicit pentru SMS și acordă permisiunea de trimitere. Dacă apare „Accesul aplicației la SMS a fost refuzat”, deschide <strong>Setări → Aplicații → Elmont SMS → ⋮ → Permite setările restricționate</strong>, confirmă cu PIN-ul, apoi intră la <strong>Permisiuni → SMS → Permite</strong>. Revino în aplicație și apasă <strong>Pornește trimiterea SMS</strong>.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={pair} disabled={busy} className="btn-primary">{config?.paired ? 'Generează cod nou' : 'Generează cod de asociere'}</button><button type="button" onClick={() => refresh().catch(() => setError('Nu am putut actualiza starea.'))} disabled={busy} className="btn-secondary inline-flex items-center gap-2"><RefreshCw size={16}/> Actualizează</button>{config?.paired && config.enabled && <button type="button" onClick={stop} disabled={busy} className="btn-secondary">Oprește gateway-ul</button>}</div>
        {pairingToken && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4"><label className="text-sm font-bold" htmlFor="sms-pairing-token">Codul de asociere, afișat o singură dată</label><textarea id="sms-pairing-token" readOnly value={pairingToken} onFocus={(event) => event.target.select()} rows={3} className="input-field mt-2 w-full break-all font-mono text-xs"/><button type="button" onClick={() => navigator.clipboard.writeText(pairingToken).then(() => setNotice('Cod copiat.')).catch(() => setError('Selectează și copiază codul manual.'))} className="btn-secondary mt-2 inline-flex items-center gap-2"><Copy size={16}/> Copiază codul</button></div>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="shrink-0"/>Codul de asociere este păstrat pe server doar ca hash. Telefonul comunică direct cu Elmont. Mesajele sunt preluate o singură dată pentru a evita dublurile.</p>
      </section>

      <section className="rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Mesaje din Branșamente</h2><p className="mt-1 text-sm text-slate-500">„În așteptare” înseamnă că telefonul nu a preluat încă mesajul; „Trimis” înseamnă predat rețelei mobile.</p></div><button type="button" onClick={() => refresh().catch(() => setError('Nu am putut actualiza mesajele.'))} className="btn-secondary inline-flex items-center gap-2"><RefreshCw size={16}/> Actualizează</button></div>
        <div className="mt-5 space-y-3">{messages.length ? messages.map((sms) => <article key={sms.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{sms.beneficiary || sms.nib}</strong><p className="text-xs text-slate-500">{sms.nib} · {sms.recipient} · {new Date(sms.createdAt).toLocaleString('ro-RO')}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${sms.state === 'Sent' || sms.state === 'Delivered' ? 'bg-emerald-50 text-emerald-700' : sms.state === 'Failed' || sms.state === 'Unknown' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{({ Pending: 'În așteptare', Dispatched: 'Preluat de telefon', Sent: 'Trimis', Failed: 'Eșuat', Delivered: 'Livrat' } as Record<string, string>)[sms.state] || sms.state}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{sms.message}</p>{sms.error && <p className="mt-2 text-xs text-rose-700">{sms.error}</p>}</article>) : <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500"><Download size={26} className="mx-auto mb-3"/>Nu există încă SMS-uri trimise din Elmont.</div>}</div>
      </section>
    </div>
  </main>
}
