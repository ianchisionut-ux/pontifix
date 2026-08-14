'use client'

import { useState } from 'react'
import { AtSign, CheckCircle2, KeyRound, Mail, Save, Send } from 'lucide-react'

export function EmailSettingsForm({ configured, fromName, fromEmail, notificationEmail, enabled }: {
  configured: boolean
  fromName: string
  fromEmail: string
  notificationEmail: string
  enabled: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [isConfigured, setIsConfigured] = useState(configured)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tested, setTested] = useState(false)
  const [error, setError] = useState('')

  async function submit(formData: FormData) {
    setBusy(true); setSaved(false); setTested(false); setError('')
    const response = await fetch('/api/settings/email', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appPassword: formData.get('appPassword'), fromName: formData.get('fromName'), fromEmail: formData.get('fromEmail'),
        notificationEmail: formData.get('notificationEmail'), enabled: formData.get('enabled') === 'on',
      }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) return setError(data.error || 'Setările de e-mail nu au putut fi salvate.')
    setIsConfigured(true); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  async function testEmail() {
    setTesting(true); setTested(false); setError('')
    const response = await fetch('/api/settings/email/test', { method: 'POST' })
    const data = await response.json().catch(() => ({}))
    setTesting(false)
    if (!response.ok) return setError(data.error || 'E-mailul de test nu a putut fi trimis.')
    setTested(true); setTimeout(() => setTested(false), 3500)
  }

  return <section className="card mt-5 p-6">
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3"><span className="settings-icon"><Mail size={19}/></span><div><h2 className="font-semibold">Yahoo Mail</h2><p className="text-sm text-slate-500">Trimiterea ofertelor, notificărilor și mesajelor pentru conturi prin adresa Yahoo Elmont.</p></div></div>
      <span className={isConfigured ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700' : 'rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700'}>{isConfigured ? 'Configurat' : 'Neconfigurat'}</span>
    </div>
    <form action={submit}>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium">Nume expeditor<input name="fromName" className="input-field mt-2 w-full" defaultValue={fromName} required/></label>
        <label className="text-sm font-medium">Adresă Yahoo<div className="relative mt-2"><AtSign size={16} className="absolute left-3 top-3.5 text-slate-400"/><input name="fromEmail" type="email" className="input-field w-full pl-10" defaultValue={fromEmail} placeholder="elmont_zalau@yahoo.com" required/></div></label>
        <label className="text-sm font-medium lg:col-span-2">E-mail pentru notificări<input name="notificationEmail" type="email" className="input-field mt-2 w-full" defaultValue={notificationEmail} required/><span className="mt-1 block text-xs font-normal text-slate-400">Aici ajung notificările când un client trimite o cerere nouă.</span></label>
        <label className="text-sm font-medium lg:col-span-2">Parolă Yahoo pentru aplicație<div className="relative mt-2"><KeyRound size={16} className="absolute left-3 top-3.5 text-slate-400"/><input name="appPassword" type="password" autoComplete="new-password" className="input-field w-full pl-10" placeholder={isConfigured ? 'Lasă gol pentru a păstra parola existentă' : 'Introdu parola generată în Yahoo'}/></div><span className="mt-1 block text-xs font-normal text-slate-400">Folosește parola generată din Yahoo Account Security, nu parola normală a contului. Este criptată înainte de salvare.</span></label>
      </div>
      <label className="mt-5 inline-flex items-center gap-2 text-sm font-medium"><input name="enabled" type="checkbox" defaultChecked={enabled} className="h-4 w-4 rounded border-slate-300 text-blue-600"/>Activează trimiterea e-mailurilor</label>
      {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {tested && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">E-mailul de test a fost trimis cu succes.</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={testEmail} className="btn-secondary inline-flex min-w-40 items-center justify-center gap-2" disabled={testing || !isConfigured}><Send size={16}/> {testing ? 'Se testează…' : 'Trimite test'}</button>
        <button className="btn-primary inline-flex min-w-40 items-center justify-center gap-2" disabled={busy}>{saved?<CheckCircle2 size={16}/>:<Save size={16}/>} {busy?'Se salvează…':saved?'Salvat':'Salvează Yahoo'}</button>
      </div>
    </form>
  </section>
}
