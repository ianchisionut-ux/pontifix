'use client'

import { useState } from 'react'
import { CheckCircle2, KeyRound, MessageCircle, Save } from 'lucide-react'

export function WhatsAppSettingsForm({ phoneNumberId, wabaId, configured, enabled }: {
  phoneNumberId: string
  wabaId: string
  configured: boolean
  enabled: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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
    setTimeout(() => setSaved(false), 2500)
  }

  return <form action={submit} className="card p-6 mt-5">
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

    <div className="grid gap-4 lg:grid-cols-2">
      <label className="text-sm font-medium">Phone Number ID
        <input name="phoneNumberId" className="input-field w-full mt-2" defaultValue={phoneNumberId} placeholder="Ex: 123456789012345" required />
        <span className="mt-1 block text-xs font-normal text-slate-400">ID-ul numărului de telefon din Meta Developers.</span>
      </label>
      <label className="text-sm font-medium">WhatsApp Business Account ID
        <input name="wabaId" className="input-field w-full mt-2" defaultValue={wabaId} placeholder="WABA ID" />
        <span className="mt-1 block text-xs font-normal text-slate-400">Identificatorul contului WhatsApp Business.</span>
      </label>
      <label className="text-sm font-medium lg:col-span-2">Access Token permanent
        <div className="relative mt-2">
          <KeyRound size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <input name="accessToken" type="password" className="input-field w-full pl-10" placeholder={configured ? 'Lasă gol pentru a păstra tokenul existent' : 'Introdu tokenul permanent Meta'} />
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
}
