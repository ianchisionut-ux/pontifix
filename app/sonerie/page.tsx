'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BellRing, Check, CheckCheck, Download, Volume2, X } from 'lucide-react'
import styles from './sonerie.module.css'

type Role = 'director' | 'ionut'
type Call = { id: string; createdAt: string; acknowledgedAt: string | null; response: 'accepted' | 'unavailable' | null; active: boolean } | null
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

function decodeVapid(value: string) {
  const base64 = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

export default function SoneriePage() {
  const [role, setRole] = useState<Role | null>(null)
  const [ready, setReady] = useState(false)
  const [call, setCall] = useState<Call>(null)
  const [available, setAvailable] = useState(true)
  const [availabilityBusy, setAvailabilityBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [soundOn, setSoundOn] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [pushOn, setPushOn] = useState(false)
  const [alertsBusy, setAlertsBusy] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [installed, setInstalled] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const installPromptRef = useRef<InstallPrompt | null>(null)
  const lastSoundRef = useRef(0)
  const callRef = useRef<Call>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/sonerie', { cache: 'no-store' })
      if (response.status === 401) { setRole(null); return }
      if (!response.ok) throw new Error('Conexiunea nu este disponibilă.')
      const data = await response.json()
      setCall(data.call)
      setAvailable(data.available)
    } catch { setError('Conexiune întreruptă. Reîncerc automat.') }
  }, [])

  useEffect(() => {
    fetch('/api/sonerie/session', { cache: 'no-store' }).then((response) => response.json())
      .then((data) => setRole(data.role || null)).catch(() => setError('Nu pot verifica accesul.'))
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sonerie-sw.js', { scope: '/sonerie' }).catch(() => undefined)
    }
    setInstalled(window.matchMedia('(display-mode: standalone)').matches)
    const onInstallPrompt = (event: Event) => {
      event.preventDefault()
      installPromptRef.current = event as InstallPrompt
      setCanInstall(true)
    }
    const onInstalled = () => {
      installPromptRef.current = null
      setCanInstall(false)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (!role) return
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 2500)
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [role, refresh])

  useEffect(() => {
    if (role !== 'ionut') return
    let cancelled = false
    if (localStorage.getItem('sonerie-sound-enabled') === 'yes' && 'AudioContext' in window) {
      setSoundOn(true)
      const audio = new AudioContext()
      audioRef.current = audio
      void audio.resume().then(() => { if (!cancelled) setAudioReady(audio.state === 'running') }).catch(() => undefined)
    }
    async function restorePush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || Notification.permission !== 'granted') return
      try {
        const worker = await navigator.serviceWorker.register('/sonerie-sw.js', { scope: '/sonerie' })
        const subscription = await worker.pushManager.getSubscription()
        if (!subscription) return
        const response = await fetch('/api/sonerie/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) })
        if (response.ok && !cancelled) setPushOn(true)
      } catch { /* Abonarea poate fi refăcută manual. */ }
    }
    void restorePush()
    return () => { cancelled = true; void audioRef.current?.close().catch(() => undefined); audioRef.current = null }
  }, [role])

  useEffect(() => { callRef.current = call }, [call])

  useEffect(() => {
    if (role !== 'ionut' || !call?.active || !soundOn || !audioReady) return
    const ring = () => {
      if (document.hidden || !callRef.current?.active || !audioRef.current) return
      const now = Date.now()
      if (now - lastSoundRef.current < 4500) return
      lastSoundRef.current = now
      const audio = audioRef.current
      void audio.resume().then(() => {
        for (const delay of [0, 0.32]) {
          const oscillator = audio.createOscillator()
          const gain = audio.createGain()
          oscillator.type = 'sine'
          oscillator.frequency.value = 740
          gain.gain.setValueAtTime(0.0001, audio.currentTime + delay)
          gain.gain.exponentialRampToValueAtTime(0.07, audio.currentTime + delay + 0.03)
          gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + delay + 0.24)
          oscillator.connect(gain).connect(audio.destination)
          oscillator.start(audio.currentTime + delay)
          oscillator.stop(audio.currentTime + delay + 0.26)
        }
      }).catch(() => undefined)
      if ('vibrate' in navigator) navigator.vibrate([110, 90, 110])
    }
    ring()
    const timer = window.setInterval(ring, 5000)
    return () => window.clearInterval(timer)
  }, [role, call?.id, call?.active, soundOn, audioReady])

  async function sendCall() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/sonerie', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nu am putut trimite chemarea.')
      setCall(data.call)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  async function setAvailability(next: boolean) {
    setAvailabilityBusy(true); setError('')
    try {
      const response = await fetch('/api/sonerie', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: next }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nu am putut salva disponibilitatea.')
      setAvailable(data.available)
      setCall(data.call)
      if (!next && 'vibrate' in navigator) navigator.vibrate(0)
    } catch (cause) { setError((cause as Error).message) }
    finally { setAvailabilityBusy(false) }
  }

  async function acknowledge(responseChoice: 'accepted' | 'unavailable') {
    if (!call) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/sonerie/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: call.id, response: responseChoice }) })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Răspunsul nu a fost trimis.')
      const data = await response.json()
      setCall(data.call)
      if ('vibrate' in navigator) navigator.vibrate(0)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  async function enableAlerts() {
    setError(''); setAlertsBusy(true)
    try {
      const audio = audioRef.current || new AudioContext()
      audioRef.current = audio
      await audio.resume()
      setSoundOn(true)
      setAudioReady(audio.state === 'running')
      localStorage.setItem('sonerie-sound-enabled', 'yes')
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setError('Acest telefon nu acceptă notificări web. Lasă pagina deschisă pentru semnalul sonor.')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setPushOn(false); setError('Notificările sunt oprite în telefon. Sunetul funcționează cât pagina este deschisă.'); return }
      const config = await fetch('/api/sonerie/push').then((response) => response.json())
      if (!config.publicKey) throw new Error('Notificările push nu sunt configurate.')
      const worker = await navigator.serviceWorker.register('/sonerie-sw.js', { scope: '/sonerie' })
      const subscription = await worker.pushManager.getSubscription() || await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapid(config.publicKey) })
      const response = await fetch('/api/sonerie/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) })
      if (!response.ok) throw new Error('Nu am putut activa notificările pe telefon.')
      setPushOn(true)
    } catch (cause) { setError((cause as Error).message || 'Nu am putut activa notificările.') }
    finally { setAlertsBusy(false) }
  }

  function unlockSound() {
    if (role !== 'ionut' || !soundOn || audioReady || !audioRef.current) return
    void audioRef.current.resume().then(() => setAudioReady(audioRef.current?.state === 'running')).catch(() => undefined)
  }

  async function installApp() {
    const prompt = installPromptRef.current
    if (!prompt) return
    installPromptRef.current = null
    setCanInstall(false)
    await prompt.prompt()
    await prompt.userChoice
  }

  const active = Boolean(call?.active)
  const unavailable = call?.response === 'unavailable'
  const accepted = call?.response === 'accepted'
  const lastCallExpired = Boolean(call && !active && !call.acknowledgedAt)
  return <main onPointerDown={unlockSound} className={`${styles.page} ${role === 'ionut' && active ? styles.alertPage : ''}`}>
    <div className={styles.shell}>
      <header className={styles.header}><span className={styles.brandIcon}><BellRing size={27}/></span><span className={styles.brandText}><strong>Sonerie</strong><small>Elmont · chemare la birou</small></span><span className={styles.headerDot}/></header>
      {!ready ? <p className={styles.muted}>Se deschide…</p> : !role ? <section className={styles.card}>
        <span className={styles.eyebrow}>ACCES PRIVAT</span>
        <h1>Link privat necesar</h1>
        <p>Deschide linkul personal primit pentru acest telefon.</p>
      </section> : role === 'director' ? <section className={styles.card}>
        <span className={styles.eyebrow}>PANOUL DIRECTORULUI</span>
        <h1>Cheamă-l pe Ionuț</h1>
        <p>Apasă butonul și va primi chemarea pe telefon.</p>
        <div className={`${styles.presenceBanner} ${available ? styles.presenceAvailable : styles.presenceUnavailable}`}><span className={styles.presenceDot}/>{available ? 'Ionuț este disponibil' : 'Ionuț nu este disponibil acum'}</div>
        <button className={styles.callButton} disabled={busy || active || !available} onClick={sendCall}><BellRing size={31}/><span>Cheamă-l pe Ionuț</span></button>
        <div className={`${styles.status} ${active ? styles.waiting : unavailable ? styles.unavailable : accepted ? styles.confirmed : ''}`} role="status" aria-live="polite">
          <span className={styles.statusIcon}>{active ? <span className={styles.statusPulse}/> : unavailable ? <X size={22}/> : accepted ? <CheckCheck size={23}/> : <Check size={22}/>}</span>
          <span>{active ? 'Chemare trimisă · aștept răspunsul' : unavailable ? 'Ionuț a răspuns: nu este disponibil' : accepted ? 'Ionuț a confirmat: vine la birou' : lastCallExpired ? 'Chemarea a expirat fără răspuns' : 'Gata pentru o chemare nouă'}</span>
        </div>
      </section> : <section className={`${styles.card} ${active ? styles.ringing : ''}`}>
        <span className={styles.eyebrow}>PENTRU IONUȚ</span>
        <div className={styles.availabilityControl}><span><strong>{available ? 'Sunt disponibil' : 'Nu sunt disponibil'}</strong><small>{available ? 'Directorul te poate chema' : 'Directorul vede că nu ești disponibil'}</small></span><button type="button" role="switch" aria-checked={available} aria-label="Sunt disponibil" disabled={availabilityBusy} onClick={() => setAvailability(!available)} className={`${styles.switch} ${available ? styles.switchOn : ''}`}><span/></button></div>
        <div className={`${styles.heroSymbol} ${active ? styles.heroSymbolActive : ''}`}>{active ? <BellRing size={48}/> : <Check size={49}/>}</div>
        <h1>{active ? 'Directorul te cheamă' : 'Aștept chemarea'}</h1>
        <p>{active ? 'Te rog să răspunzi acum.' : 'Vei vedea aici imediat ce ești chemat.'}</p>
        {active && <div className={styles.responseActions}>
          <button className={styles.acceptButton} disabled={busy} onClick={() => acknowledge('accepted')}><Check size={27}/> Vin la birou</button>
          <button className={styles.declineButton} disabled={busy} onClick={() => acknowledge('unavailable')}><X size={25}/> Nu sunt disponibil</button>
        </div>}
        <div className={`${styles.status} ${active ? styles.waiting : unavailable ? styles.unavailable : accepted ? styles.confirmed : ''}`} role="status" aria-live="polite">
          <span className={styles.statusIcon}>{active ? <span className={styles.statusPulse}/> : unavailable ? <X size={22}/> : <Check size={22}/>}</span>
          <span>{active ? 'Alege unul dintre cele două răspunsuri' : unavailable ? 'Ai anunțat că nu ești disponibil' : accepted ? 'Ai confirmat că vii la birou' : 'Pregătit pentru chemare'}</span>
        </div>
      </section>}
      {role === 'ionut' && <section className={styles.alertsCard} aria-label="Semnale pe telefon">
        <div className={styles.alertsHeading}><div><span className={styles.eyebrow}>SETĂRI TELEFON</span><h2>Semnale de chemare</h2></div><BellRing size={25}/></div>
        <div className={styles.signalRow}><Volume2 size={22}/><span>Sunet în aplicație</span><strong className={audioReady ? styles.signalOn : styles.signalOff}>{audioReady ? 'Activ' : soundOn ? 'Atinge ecranul' : 'Inactiv'}</strong></div>
        <div className={styles.signalRow}><BellRing size={22}/><span>Notificare pe telefon</span><strong className={pushOn ? styles.signalOn : styles.signalOff}>{pushOn ? 'Activă' : 'Inactivă'}</strong></div>
        <div className={styles.signalRow}><span className={styles.visualDot}/><span>Semnal vizual</span><strong className={styles.signalOn}>Activ</strong></div>
        {(!pushOn || !soundOn) && <button className={styles.secondary} disabled={alertsBusy} onClick={enableAlerts}>{alertsBusy ? 'Se activează…' : 'Activează sunetul și notificările'}</button>}
        {soundOn && !audioReady && <p className={styles.touchNote}>Atinge ecranul o dată pentru a relua sunetul.</p>}
        {pushOn && audioReady && <p className={styles.readyNote}><Check size={17}/> Totul este pregătit. Nu trebuie să activezi din nou după refresh.</p>}
      </section>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {role && !installed && <div className={styles.install}>
        {canInstall && <button className={styles.installButton} onClick={installApp}><Download size={18}/> Instalează Sonerie separat</button>}
        <p>Pe Android, în Chrome: ⋮ → Instalează aplicația. Va apărea o pictogramă „Sonerie”, separată de Elmont.</p>
      </div>}
    </div>
  </main>
}
