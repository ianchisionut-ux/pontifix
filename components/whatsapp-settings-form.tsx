'use client'

import { useState } from 'react'
import { CheckCircle2, KeyRound, MessageCircle, PhoneCall, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function WhatsAppSettingsForm({ phoneNumberId, wabaId, configured, enabled }: {
  phoneNumberId: string
  wabaId: string
  configured: boolean
  enabled: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [registerMessage, setRegisterMessage] = useState('')
  const [registerError, setRegisterError] = useState('')

  async function submit(formData: FormData) {
    setBusy(true)
    setSaved(false)
    setError('')
    const response = await fetch('/api/settings/whatsapp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumberId: formData.get('phoneNumberId'),
        wabaId: formData.get('wabaId'),
        accessToken: formData.get('accessToken'),
        enabled: formData.get('enabled') === 'on',
      }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) return setError(data.error || 'Setările WhatsApp nu au putut fi salvate.')
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2500)
  }

  async function registerNumber(formData: FormData) {
    setRegistering(true)
    setRegisterMessage('')
    setRegisterError('')
    const response = await fetch('/api/settings/whatsapp/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: formData.get('pin') }),
    })
    const data = await response.json().catch(() => ({}))
    setRegistering(false)
    if (!response.ok) return setRegisterError(data.error || 'Numărul nu a putut fi înregistrat.')
    setRegisterMessage(data.warning || 'Numărul a fost înregistrat și webhookul a fost abonat cu succes.')
    router.refresh()
  }

  return <section className="card p-6 mt-5">
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-center gap-3">
        <span className="settings-icon"><MessageCircle size={19}/></span>
        <div>
          <h2 className="font-semibold">WhatsApp Business</h2>
          <p className="text-sm text-slate-500">Configurare Meta Cloud API pentru actualizările trimise beneficiarilor proiectelor.</p>
        </div>
      </div>
      <span className={configured ? 'text-xs rounded-full bg-emerald-50 px-3 py-1 text-emerald-700' : 'text-xs rounded-full bg-amber-50 px-3 py-1 text-amber-700'}>
        {configured ? 'Configurat' : 'Neconfigurat'}
      </span>
    </div>

    <form action={submit}>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium">Phone Number ID
          <input name="phoneNumberId" className="input-field w-full mt-2" defaultValue={phoneNumberId} placeholder="Ex: 123456789012345" required />
          <span className="mt-1 block text-xs font-normal text-slate-400">ID-ul numărului de telefon din Meta Developers.</span>
        </label>
        <label className="text-sm font-medium">WhatsApp Business Account ID
          <input name="wabaId" className="input-field w-full mt-2" defaultValue={wabaId} placeholder="WABA ID" required />
          <span className="mt-1 block text-xs font-normal text-slate-400">Identificatorul contului WhatsApp Business.</span>
        </label>
        <label className="text-sm font-medium lg:col-span-2">Access Token permanent
          <div className="relative mt-2">
            <KeyRound size={16} className="absolute left-3 top-3.5 text-slate-400" />
            <input name="accessToken" type="password" className="input-field input-field-with-icon w-full" placeholder={configured ? 'Lasă gol pentru a păstra tokenul existent' : 'Introdu tokenul permanent Meta'} />
          </div>
          <span className="mt-1 block text-xs font-normal text-slate-400">Tokenul este criptat înainte de salvarea în baza de date și nu va fi afișat ulterior.</span>
        </label>
      </div>

      <label className="mt-5 inline-flex items-center gap-2 text-sm font-medium">
        <input name="enabled" type="checkbox" defaultChecked={enabled} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
        Activează trimiterea directă prin WhatsApp
      </label>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex justify-end">
        <button className="btn-primary inline-flex min-w-40 items-center justify-center gap-2" disabled={busy}>
          {saved ? <CheckCircle2 size={16}/> : <Save size={16}/>}
          {busy ? 'Se salvează...' : saved ? 'Salvat' : 'Salvează WhatsApp'}
        </button>
      </div>
    </form>

    <div className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex items-start gap-3">
        <span className="settings-icon"><PhoneCall size={19}/></span>
        <div>
          <h3 className="font-semibold">Înregistrează numărul în Cloud API</h3>
          <p className="text-sm text-slate-500">Salvează mai întâi datele de mai sus, apoi alege un PIN nou de exact 6 cifre.</p>
        </div>
      </div>
      <form action={registerNumber} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">PIN nou de 6 cifre
          <input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} className="input-field mt-2 block w-52" placeholder="••••••" autoComplete="new-password" required />
        </label>
        <button className="btn-primary inline-flex items-center gap-2" disabled={registering || !configured}>
          <PhoneCall size={16}/>
          {registering ? 'Se înregistrează...' : 'Înregistrează numărul'}
        </button>
      </form>
      {!configured && <p className="mt-2 text-xs text-amber-600">Salvează Phone Number ID, WABA ID și Access Token înainte de înregistrare.</p>}
      {registerError && <p className="mt-3 text-sm text-red-600">{registerError}</p>}
      {registerMessage && <p className="mt-3 text-sm font-medium text-emerald-700">{registerMessage}</p>}
    </div>
  </section>
}
