'use client'

import { useState } from 'react'
import { AtSign, CheckCircle2, KeyRound, Mail, Save } from 'lucide-react'

export function EmailSettingsForm({ configured, fromName, fromEmail, notificationEmail, enabled }: {
  configured: boolean
  fromName: string
  fromEmail: string
  notificationEmail: string
  enabled: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function submit(formData: FormData) {
    setBusy(true); setSaved(false); setError('')
    const response = await fetch('/api/settings/email', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: formData.get('apiKey'), fromName: formData.get('fromName'), fromEmail: formData.get('fromEmail'),
        notificationEmail: formData.get('notificationEmail'), enabled: formData.get('enabled') === 'on',
      }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) return setError(data.error || 'Setările de e-mail nu au putut fi salvate.')
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  return <section className="card mt-5 p-6">
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3"><span className="settings-icon"><Mail size={19}/></span><div><h2 className="font-semibold">E-mail</h2><p className="text-sm text-slate-500">Trimiterea ofertelor și notificările pentru cererile primite de pe site.</p></div></div>
      <span className={configured ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700' : 'rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700'}>{configured ? 'Configurat' : 'Neconfigurat'}</span>
    </div>
    <form action={submit}>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium">Nume expeditor<input name="fromName" className="input-field mt-2 w-full" defaultValue={fromName} required/></label>
        <label className="text-sm font-medium">Adresă expeditor<div className="relative mt-2"><AtSign size={16} className="absolute left-3 top-3.5 text-slate-400"/><input name="fromEmail" type="email" className="input-field w-full pl-10" defaultValue={fromEmail} required/></div></label>
        <label className="text-sm font-medium lg:col-span-2">E-mail pentru notificări<input name="notificationEmail" type="email" className="input-field mt-2 w-full" defaultValue={notificationEmail} required/><span className="mt-1 block text-xs font-normal text-slate-400">Aici ajung notificările când un client trimite o cerere nouă.</span></label>
        <label className="text-sm font-medium lg:col-span-2">Resend API Key<div className="relative mt-2"><KeyRound size={16} className="absolute left-3 top-3.5 text-slate-400"/><input name="apiKey" type="password" className="input-field w-full pl-10" placeholder={configured ? 'Lasă gol pentru a păstra cheia existentă' : 're_…'}/></div><span className="mt-1 block text-xs font-normal text-slate-400">Cheia este criptată înainte de salvare. Adresa expeditorului trebuie verificată în Resend.</span></label>
      </div>
      <label className="mt-5 inline-flex items-center gap-2 text-sm font-medium"><input name="enabled" type="checkbox" defaultChecked={enabled} className="h-4 w-4 rounded border-slate-300 text-blue-600"/>Activează trimiterea e-mailurilor</label>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex justify-end"><button className="btn-primary inline-flex min-w-40 items-center justify-center gap-2" disabled={busy}>{saved?<CheckCircle2 size={16}/>:<Save size={16}/>} {busy?'Se salvează…':saved?'Salvat':'Salvează e-mail'}</button></div>
    </form>
  </section>
}
