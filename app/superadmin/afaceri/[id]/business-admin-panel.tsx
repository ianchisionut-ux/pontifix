'use client'

import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'
import BillingSection from './billing-section'

const CATEGORY_LABEL: Record<string, string> = {
  SALON: 'Salon',
  EVENT_VENUE: 'Spații evenimente',
  HOTEL: 'Hotel',
  PENSIUNE: 'Pensiune',
  CLINICA: 'Clinică',
}

type Channel = { id: string; type: string; externalId: string; wabaId: string | null; status: string }
type Business = {
  id: string
  slug: string
  name: string
  category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'
  accountActive: boolean
  publicListed: boolean
  ownerEmail: string | null
  bookingsCount: number
  revenue: number
  planName: string | null
  teamSize: number
  billingStatus: 'GRATUIT' | 'NEPLATIT' | 'PLATIT' | 'RESTANT'
  billingNote: string | null
}

export default function BusinessAdminPanel({ business, channels }: { business: Business; channels: Channel[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(business.name)
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [teamMode, setTeamMode] = useState(business.teamSize > 1)
  const [savingTeam, setSavingTeam] = useState(false)
  const [teamSaved, setTeamSaved] = useState(false)
  const teamModeChanged = teamMode !== (business.teamSize > 1)

  async function saveTeamMode() {
    setSavingTeam(true)
    setTeamSaved(false)
    try {
      await fetch(`/api/superadmin/businesses/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamSize: teamMode ? 2 : 1 }),
      })
      setTeamSaved(true)
      router.refresh()
    } finally {
      setSavingTeam(false)
    }
  }

  async function saveName() {
    setLoading(true)
    await fetch(`/api/superadmin/businesses/${business.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setEditing(false)
    setLoading(false)
    router.refresh()
  }

  async function toggleActive() {
    setLoading(true)
    await fetch(`/api/superadmin/businesses/${business.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountActive: !business.accountActive }),
    })
    setLoading(false)
    router.refresh()
  }

  async function resetPassword() {
    if (!confirm(`Trimiți un link de resetare a parolei către ${business.ownerEmail}?`)) return
    setLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/superadmin/businesses/${business.id}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) setResetSentTo(data.email)
      else alert(data.error ?? 'A apărut o eroare.')
    } catch {
      alert('Conexiune eșuată. Verifică internetul și încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  async function deleteForever() {
    const confirmation = prompt(`Această acțiune e ireversibilă. Scrie "${business.name}" pentru confirmare:`)
    if (confirmation !== business.name) return
    setLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/superadmin/businesses/${business.id}`, { method: 'DELETE' }, 30000)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Ștergerea a eșuat.')
        return
      }
      router.push('/superadmin/afaceri')
    } catch {
      alert('Conexiune eșuată. Verifică internetul și încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lg:grid lg:grid-cols-[1fr_380px] gap-5 items-start flex flex-col lg:flex">
      {/* Header — nume, status, stats — pe toată lățimea */}
      <Card className="lg:col-span-2">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {editing ? (
                <Input value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
              ) : (
                <h1 className="text-xl font-semibold">{business.name}</h1>
              )}
              <Pill tone="accent">{CATEGORY_LABEL[business.category] ?? business.category}</Pill>
              <Pill tone={business.teamSize > 1 ? 'accent' : 'neutral'}>
                {business.teamSize > 1 ? 'Echipă' : 'Individual'}
              </Pill>
              <Pill tone={business.accountActive ? 'success' : 'danger'}>{business.accountActive ? 'Activ' : 'Dezactivat'}</Pill>
            </div>
            <p className="text-sm text-gray-500">
              {business.ownerEmail ?? 'fără cont owner'} · {business.planName ?? 'fără abonament'}
            </p>
            <a
              href={`/${business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              bookeasy.ro/{business.slug} ↗
            </a>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{business.bookingsCount} rezervări</p>
            <p className="text-gray-500">{business.revenue.toLocaleString('ro-RO')} lei încasări est.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button variant="secondary" onClick={saveName} disabled={loading}>
                Salvează numele
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Anulează
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              ✎ Editează
            </Button>
          )}
          <Button variant="secondary" onClick={resetPassword} disabled={loading || !business.ownerEmail}>
            🔑 Trimite link resetare parolă
          </Button>
          <button
            onClick={toggleActive}
            disabled={loading}
            className={`btn-secondary ${business.accountActive ? 'text-red-600' : 'text-green-700'}`}
          >
            {business.accountActive ? 'Dezactivează' : 'Activează'}
          </button>
          <button onClick={deleteForever} disabled={loading} className="btn-secondary text-red-600">
            🗑 Șterge definitiv
          </button>
        </div>

        {resetSentTo && (
          <div className="mt-4 rounded-xl bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent)]">
            Link de configurare a parolei trimis către <strong>{resetSentTo}</strong>. Linkul expiră în 24 de ore.
          </div>
        )}
      </Card>

      {/* Coloana stângă — profil, facturare */}
      <div className="flex flex-col gap-5">
        <Card>
          <h2 className="font-medium mb-1">Profilul afacerii</h2>
          <p className="text-sm text-gray-500 mb-3">
            Individual — un singur calendar, gestiune unică (ca acum). Echipă — proprietarul poate
            adăuga mai mulți medici/angajați, fiecare cu programul lui, calendar separabil per persoană.
          </p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTeamMode(false)}
              className="flex-1 p-3 rounded-2xl border text-left"
              style={{
                borderColor: !teamMode ? 'var(--accent)' : 'var(--border-soft)',
                background: !teamMode ? 'var(--accent-soft)' : 'white',
              }}
            >
              <p className="text-sm font-medium">Individual</p>
              <p className="text-xs text-gray-500">1 calendar, fără alegere de persoană</p>
            </button>
            <button
              onClick={() => setTeamMode(true)}
              className="flex-1 p-3 rounded-2xl border text-left"
              style={{
                borderColor: teamMode ? 'var(--accent)' : 'var(--border-soft)',
                background: teamMode ? 'var(--accent-soft)' : 'white',
              }}
            >
              <p className="text-sm font-medium">Echipă (mai mulți medici/angajați)</p>
              <p className="text-xs text-gray-500">Calendar separat, selectabil, per persoană</p>
            </button>
          </div>
          {teamModeChanged && (
            <div className="flex items-center gap-3">
              <Button onClick={saveTeamMode} disabled={savingTeam}>
                {savingTeam ? 'Se salvează...' : 'Salvează profilul'}
              </Button>
              <span className="text-xs text-amber-600">Modificare nesalvată</span>
            </div>
          )}
          {teamSaved && !teamModeChanged && <p className="text-xs text-green-700">✓ Salvat</p>}
        </Card>

        <BillingSection
          businessId={business.id}
          initialPlanName={business.planName}
          initialStatus={business.billingStatus}
          initialNote={business.billingNote}
        />
      </div>

      {/* Coloana dreaptă — integrări unificate, plată */}
      <div className="flex flex-col gap-5">
        <IntegrationsCard businessId={business.id} channels={channels} />
        <PaymentSection businessId={business.id} />
      </div>
    </div>
  )
}

function IntegrationsCard({ businessId, channels }: { businessId: string; channels: Channel[] }) {
  const [tab, setTab] = useState<'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'GOOGLE_BUSINESS'>('FACEBOOK')

  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'FACEBOOK', label: 'Messenger' },
    { id: 'INSTAGRAM', label: 'Instagram' },
    { id: 'WHATSAPP', label: 'WhatsApp' },
    { id: 'GOOGLE_BUSINESS', label: 'Google' },
  ]

  return (
    <Card>
      <h2 className="text-xs font-semibold text-gray-500 tracking-wide mb-3">INTEGRĂRI</h2>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {tabs.map((t) => {
          const channel = channels.find((c) => c.type === t.id)
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1"
              style={
                tab === t.id
                  ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
                  : { borderColor: 'var(--border-soft)' }
              }
            >
              {t.label}
              {channel?.status === 'ACTIVE' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />}
            </button>
          )
        })}
      </div>

      {tab === 'FACEBOOK' && (
        <ChannelFields
          businessId={businessId}
          type="FACEBOOK"
          channel={channels.find((c) => c.type === 'FACEBOOK') ?? null}
          idLabel="Page ID"
          idPlaceholder="ex: 120984102888104"
        />
      )}
      {tab === 'INSTAGRAM' && (
        <ChannelFields
          businessId={businessId}
          type="INSTAGRAM"
          channel={channels.find((c) => c.type === 'INSTAGRAM') ?? null}
          idLabel="Instagram Business Account ID"
          idPlaceholder="ex: 178414000000000"
          helpText="Contul Instagram trebuie să fie profesional (Business/Creator) și legat de aceeași Pagină de Facebook ca Messenger."
        />
      )}
      {tab === 'WHATSAPP' && <WhatsAppFields businessId={businessId} channel={channels.find((c) => c.type === 'WHATSAPP') ?? null} />}
      {tab === 'GOOGLE_BUSINESS' && (
        <ChannelFields
          businessId={businessId}
          type="GOOGLE_BUSINESS"
          channel={channels.find((c) => c.type === 'GOOGLE_BUSINESS') ?? null}
          idLabel="Location / Account ID"
          idPlaceholder="ex: accounts/123/locations/456"
        />
      )}
    </Card>
  )
}

function ChannelFields({
  businessId,
  type,
  channel,
  idLabel,
  idPlaceholder,
  helpText,
}: {
  businessId: string
  type: string
  channel: Channel | null
  idLabel: string
  idPlaceholder: string
  helpText?: string
}) {
  const router = useRouter()
  const [externalId, setExternalId] = useState(channel?.externalId ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/superadmin/businesses/${businessId}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, externalId, accessToken: accessToken || undefined }),
    })
    setAccessToken('')
    setSaving(false)
    router.refresh()
  }

  return (
    <div>
      {channel && (
        <div className="mb-3">
          <Pill tone={channel.status === 'ACTIVE' ? 'success' : 'neutral'}>{channel.status}</Pill>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">{idLabel}</label>
          <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder={idPlaceholder} />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Access Token</label>
          <Input
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Lasă gol dacă nu schimbi"
            type="password"
          />
        </div>
      </div>
      {helpText && <p className="text-xs text-gray-400 mt-2">{helpText}</p>}
      <div className="mt-3">
        <Button variant="secondary" onClick={save} disabled={saving || !externalId}>
          {saving ? 'Se salvează...' : 'Salvează'}
        </Button>
      </div>
    </div>
  )
}

function WhatsAppFields({ businessId, channel }: { businessId: string; channel: Channel | null }) {
  const router = useRouter()
  const [externalId, setExternalId] = useState(channel?.externalId ?? '')
  const [wabaId, setWabaId] = useState(channel?.wabaId ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [message, setMessage] = useState('')

  async function save() {
    setSaving(true)
    await fetch(`/api/superadmin/businesses/${businessId}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'WHATSAPP', externalId, wabaId, accessToken: accessToken || undefined }),
    })
    setAccessToken('')
    setSaving(false)
    router.refresh()
  }

  async function subscribe() {
    setSubscribing(true)
    setMessage('')
    const res = await fetch(`/api/superadmin/businesses/${businessId}/whatsapp-subscribe`, { method: 'POST' })
    const data = await res.json()
    setMessage(res.ok ? 'Abonat cu succes — webhook-ul WhatsApp e activ.' : data.error)
    setSubscribing(false)
  }

  return (
    <div>
      {channel && (
        <div className="mb-3">
          <Pill tone={channel.status === 'ACTIVE' ? 'success' : 'neutral'}>{channel.status}</Pill>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Phone Number ID</label>
          <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="ex: 126137824372250" />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Access Token</label>
          <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Lasă gol dacă nu schimbi" type="password" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">WhatsApp Business Account ID (WABA)</label>
          <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="ex: 120826654809241" />
        </div>
        <div className="flex items-end">
          <button onClick={subscribe} disabled={subscribing} className="btn-secondary w-full">
            {subscribing ? 'Se abonează...' : 'Abonează aplicația la WhatsApp'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Pas obligatoriu, o singură dată per business — altfel WhatsApp nu trimite niciun mesaj către
        webhook, chiar dacă restul e configurat corect. Salvează întâi Token-ul și WABA ID-ul, apoi apasă butonul.
      </p>

      {message && <p className="text-xs mt-2 text-[var(--accent)]">{message}</p>}

      <div className="mt-3">
        <Button variant="secondary" onClick={save} disabled={saving || !externalId}>
          {saving ? 'Se salvează...' : 'Salvează'}
        </Button>
      </div>
    </div>
  )
}

function PaymentSection({ businessId }: { businessId: string }) {
  const [processor, setProcessor] = useState<'STRIPE' | 'NETOPIA' | 'EUPLATESC' | ''>('')
  const [fields, setFields] = useState({
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    netopiaApiKey: '',
    netopiaPosSignature: '',
    netopiaPublicKey: '',
    netopiaIsLive: false,
    euplatescMerchantId: '',
    euplatescSecretKey: '',
    euplatescIsLive: false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    const payload: Record<string, any> = { paymentProcessor: processor || null }
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== '' && v !== false) payload[k] = v
    })

    await fetch(`/api/superadmin/businesses/${businessId}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setFields({
      stripeSecretKey: '',
      stripeWebhookSecret: '',
      netopiaApiKey: '',
      netopiaPosSignature: '',
      netopiaPublicKey: '',
      netopiaIsLive: fields.netopiaIsLive,
      euplatescMerchantId: '',
      euplatescSecretKey: '',
      euplatescIsLive: fields.euplatescIsLive,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Card>
      <h2 className="text-xs font-semibold text-gray-500 tracking-wide mb-1">
        PLATĂ ONLINE — CONTUL PROPRIU AL AFACERII
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Relevant pentru spații de evenimente care încasează avans direct. Fiecare afacere folosește
        propriul cont — banii intră direct la ea, nu la bookeasy.ro.
      </p>

      <label className="text-sm text-gray-500 block mb-1.5">Procesor de plăți</label>
      <select value={processor} onChange={(e) => setProcessor(e.target.value as any)} className="input-field mb-4">
        <option value="">— Dezactivat —</option>
        <option value="STRIPE">Stripe</option>
        <option value="NETOPIA">Netopia</option>
        <option value="EUPLATESC">EuPlatesc.ro</option>
      </select>

      {processor === 'STRIPE' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Secret Key</label>
            <Input
              value={fields.stripeSecretKey}
              onChange={(e) => setFields({ ...fields, stripeSecretKey: e.target.value })}
              placeholder="Lasă gol dacă nu schimbi (sk_...)"
              type="password"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Webhook Signing Secret</label>
            <Input
              value={fields.stripeWebhookSecret}
              onChange={(e) => setFields({ ...fields, stripeWebhookSecret: e.target.value })}
              placeholder="Lasă gol dacă nu schimbi (whsec_...)"
              type="password"
            />
          </div>
          <p className="col-span-2 text-xs text-gray-400">
            Cheile se iau din Stripe Dashboard → Developers → API keys.
          </p>
        </div>
      )}

      {processor === 'NETOPIA' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">API Key</label>
            <Input value={fields.netopiaApiKey} onChange={(e) => setFields({ ...fields, netopiaApiKey: e.target.value })} placeholder="Lasă gol dacă nu schimbi" type="password" />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">POS Signature</label>
            <Input value={fields.netopiaPosSignature} onChange={(e) => setFields({ ...fields, netopiaPosSignature: e.target.value })} placeholder="Lasă gol dacă nu schimbi" type="password" />
          </div>
          <div className="col-span-2">
            <label className="text-sm text-gray-500 block mb-1.5">Public Key (pentru verificare IPN)</label>
            <Input value={fields.netopiaPublicKey} onChange={(e) => setFields({ ...fields, netopiaPublicKey: e.target.value })} placeholder="Lasă gol dacă nu schimbi" type="password" />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={fields.netopiaIsLive} onChange={(e) => setFields({ ...fields, netopiaIsLive: e.target.checked })} />
            Cont live (nebifat = sandbox de test)
          </label>
          <p className="col-span-2 text-xs text-gray-400">
            Cheile se iau din contul Netopia al afacerii. Notify URL de configurat acolo:
            /api/webhooks/netopia/{'{slug}'}
          </p>
        </div>
      )}

      {processor === 'EUPLATESC' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Merchant ID</label>
            <Input value={fields.euplatescMerchantId} onChange={(e) => setFields({ ...fields, euplatescMerchantId: e.target.value })} placeholder="Lasă gol dacă nu schimbi" type="password" />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Secret Key</label>
            <Input value={fields.euplatescSecretKey} onChange={(e) => setFields({ ...fields, euplatescSecretKey: e.target.value })} placeholder="Lasă gol dacă nu schimbi" type="password" />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={fields.euplatescIsLive} onChange={(e) => setFields({ ...fields, euplatescIsLive: e.target.checked })} />
            Cont live (nebifat = sandbox de test)
          </label>
          <p className="col-span-2 text-xs text-gray-400">
            Cheile se iau din contul EuPlatesc.ro al afacerii. Silent URL de configurat acolo:
            /api/webhooks/euplatesc/{'{slug}'}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <Button variant="secondary" onClick={save} disabled={saving}>
          {saving ? 'Se salvează...' : 'Salvează'}
        </Button>
        {saved && <span className="text-xs text-green-700">Salvat.</span>}
      </div>
    </Card>
  )
}
