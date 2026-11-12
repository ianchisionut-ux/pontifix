'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './sonerie.module.css'

type Role = 'director' | 'ionut'
type Call = { id: string; createdAt: string; acknowledgedAt: string | null; active: boolean } | null

function decodeVapid(value: string) {
  const base64 = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

export default function SoneriePage() {
  const [role, setRole] = useState<Role | null>(null)
  const [ready, setReady] = useState(false)
  const [call, setCall] = useState<Call>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [soundOn, setSoundOn] = useState(false)
  const [pushOn, setPushOn] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const lastSoundRef = useRef(0)
  const callRef = useRef<Call>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/sonerie', { cache: 'no-store' })
      if (response.status === 401) { setRole(null); return }
      if (!response.ok) throw new Error('Conexiunea nu este disponibilă.')
      const data = await response.json()
      setCall(data.call)
    } catch { setError('Conexiune întreruptă. Reîncerc automat.') }
  }, [])

  useEffect(() => {
    fetch('/api/sonerie/session', { cache: 'no-store' }).then((response) => response.json())
      .then((data) => setRole(data.role || null)).catch(() => setError('Nu pot verifica accesul.'))
      .finally(() => setReady(true))
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

  useEffect(() => { callRef.current = call }, [call])

  useEffect(() => {
    if (role !== 'ionut' || !call?.active || !soundOn) return
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
  }, [role, call?.id, call?.active, soundOn])

  async function sendCall() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/sonerie', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nu am putut trimite chemarea.')
      setCall(data.call)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  async function acknowledge() {
    if (!call) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/sonerie/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: call.id }) })
      if (!response.ok) throw new Error('Confirmarea nu a fost trimisă.')
      setCall({ ...call, active: false, acknowledgedAt: new Date().toISOString() })
      if ('vibrate' in navigator) navigator.vibrate(0)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  async function enableAlerts() {
    setError('')
    try {
      const audio = audioRef.current || new AudioContext()
      audioRef.current = audio
      await audio.resume()
      setSoundOn(true)
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setError('Acest telefon nu acceptă notificări web. Lasă pagina deschisă pentru semnalul sonor.')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setError('Notificările sunt oprite în telefon. Sunetul funcționează cât pagina este deschisă.'); return }
      const config = await fetch('/api/sonerie/push').then((response) => response.json())
      if (!config.publicKey) throw new Error('Notificările push nu sunt configurate.')
      const worker = await navigator.serviceWorker.ready
      const subscription = await worker.pushManager.getSubscription() || await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapid(config.publicKey) })
      const response = await fetch('/api/sonerie/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) })
      if (!response.ok) throw new Error('Nu am putut activa notificările pe telefon.')
      setPushOn(true)
    } catch (cause) { setError((cause as Error).message || 'Nu am putut activa notificările.') }
  }

  const active = Boolean(call?.active)
  return <main className={`${styles.page} ${role === 'ionut' && active ? styles.alertPage : ''}`}>
    <div className={styles.shell}>
      <header className={styles.header}><span className={styles.brandIcon}>◉</span><span>Sonerie birou</span></header>
      {!ready ? <p className={styles.muted}>Se deschide…</p> : !role ? <section className={styles.card}>
        <span className={styles.eyebrow}>ACCES PRIVAT</span>
        <h1>Link privat necesar</h1>
        <p>Deschide linkul personal primit pentru acest telefon.</p>
      </section> : role === 'director' ? <section className={styles.card}>
        <span className={styles.eyebrow}>DIRECTOR</span>
        <h1>Cheamă-l pe Ionuț</h1>
        <p>O apăsare trimite chemarea pe telefonul lui.</p>
        <button className={styles.callButton} disabled={busy || active} onClick={sendCall}><span>◉</span>Ionuț</button>
        <div className={`${styles.status} ${active ? styles.waiting : call?.acknowledgedAt ? styles.confirmed : ''}`} aria-live="polite">
          {active ? 'Chemare trimisă · aștept confirmarea' : call?.acknowledgedAt ? 'Ionuț a confirmat: vine la birou' : 'Gata pentru chemare'}
        </div>
      </section> : <section className={`${styles.card} ${active ? styles.ringing : ''}`}>
        <span className={styles.eyebrow}>IONUȚ</span>
        <h1>{active ? 'Directorul te cheamă' : 'Ești disponibil'}</h1>
        <p>{active ? 'Te rog să vii la birou.' : 'Vei vedea aici când te cheamă directorul.'}</p>
        {active ? <button className={styles.callButton} disabled={busy} onClick={acknowledge}>Vin la birou</button> : <div className={styles.idleIcon}>✓</div>}
        <div className={styles.status} aria-live="polite">{active ? 'Apasă „Vin la birou” pentru confirmare' : call?.acknowledgedAt ? 'Ultima chemare a fost confirmată' : 'Aștept chemarea'}</div>
        <button className={styles.secondary} onClick={enableAlerts}>{pushOn ? 'Notificări activate ✓' : soundOn ? 'Activează notificările' : 'Activează sunetul și notificările'}</button>
      </section>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.install}>Adaugă această pagină pe ecranul principal al telefonului. Pe iPhone: Partajare → Adaugă la ecranul principal.</p>
    </div>
  </main>
}
