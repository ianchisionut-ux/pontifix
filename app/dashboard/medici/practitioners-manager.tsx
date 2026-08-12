'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardInteractive } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Time10Select } from '@/components/working-date-time-picker'

type WorkingHour = { weekday: number; startTime: string; endTime: string }
type Practitioner = {
  id: string
  name: string
  specialization: string | null
  bio: string | null
  active: boolean
  workingHours: WorkingHour[]
  serviceIds: string[]
  break1Start: string | null
  break1End: string | null
  break2Start: string | null
  break2End: string | null
  break3Start: string | null
  break3End: string | null
  googleCalendar: {
    googleEmail: string | null
    calendarName: string
    syncEnabled: boolean
    includeCustomerDetails: boolean
    lastSyncAt: string | null
    lastError: string | null
  } | null
}

const WEEKDAY_LABELS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default function PractitionersManager({
  isClinic,
  practitioners,
  services,
}: {
  isClinic: boolean
  practitioners: Practitioner[]
  services: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSpecialization, setNewSpecialization] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const label = isClinic ? 'medic' : 'profesionist'
  const labelPlural = isClinic ? 'Medici' : 'Profesioniști'
  const labelCap = isClinic ? 'Medic' : 'Profesionist'

  async function createPractitioner() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await fetchWithTimeout('/api/business/practitioners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, specialization: newSpecialization || undefined }),
      })
      setNewName('')
      setNewSpecialization('')
      setAdding(false)
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  async function deletePractitioner(id: string) {
    if (!confirm(`Ștergi definitiv acest(ă) ${label}?`)) return
    try {
      const res = await fetchWithTimeout(`/api/business/practitioners/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Ștergerea a eșuat.')
        return
      }
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
        <h1 className="text-2xl font-semibold">{labelPlural}</h1>
        <Button onClick={() => setAdding((v) => !v)}>{adding ? 'Anulează' : `+ Adaugă ${label}`}</Button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Fiecare {label} are propriul program și, opțional, serviciile pe care le oferă. Clienții pot
        alege un(o) {label} anume la {isClinic ? 'programare' : 'rezervare'}.
      </p>

      {adding && (
        <Card className="mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <Input placeholder="Nume" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Specializare (opțional)" value={newSpecialization} onChange={(e) => setNewSpecialization(e.target.value)} />
          </div>
          <Button onClick={createPractitioner} disabled={saving || !newName.trim()}>
            {saving ? 'Se salvează...' : 'Salvează'}
          </Button>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {practitioners.map((p) => (
          <CardInteractive key={p.id} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{p.name}</p>
                {p.specialization && <p className="text-sm text-gray-500">{p.specialization}</p>}
              </div>
              <div className="flex items-center gap-3">
                {!p.active && <span className="text-xs text-gray-400">Inactiv</span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deletePractitioner(p.id)
                  }}
                  className="text-xs text-red-600 font-medium"
                >
                  Șterge
                </button>
              </div>
            </div>

            {expandedId === p.id && (
              <div onClick={(e) => e.stopPropagation()} className="mt-4 pt-4 border-t border-[var(--border-soft)]">
                <PractitionerDetail practitioner={p} services={services} onSaved={() => router.refresh()} />
              </div>
            )}
          </CardInteractive>
        ))}
        {practitioners.length === 0 && !adding && (
          <p className="text-sm text-gray-500">Niciun {label} adăugat încă. Apasă "+ Adaugă {label}" ca să începi.</p>
        )}
      </div>
    </div>
  )
}

function PractitionerDetail({
  practitioner,
  services,
  onSaved,
}: {
  practitioner: Practitioner
  services: { id: string; name: string }[]
  onSaved: () => void
}) {
  const [hours, setHours] = useState<WorkingHour[]>(practitioner.workingHours)
  const [serviceIds, setServiceIds] = useState<string[]>(practitioner.serviceIds)
  const [active, setActive] = useState(practitioner.active)
  const [break1Enabled, setBreak1Enabled] = useState(!!practitioner.break1Start)
  const [break1Start, setBreak1Start] = useState(practitioner.break1Start ?? '13:00')
  const [break1End, setBreak1End] = useState(practitioner.break1End ?? '14:00')
  const [break2Enabled, setBreak2Enabled] = useState(!!practitioner.break2Start)
  const [break2Start, setBreak2Start] = useState(practitioner.break2Start ?? '16:00')
  const [break2End, setBreak2End] = useState(practitioner.break2End ?? '16:15')
  const [break3Enabled, setBreak3Enabled] = useState(!!practitioner.break3Start)
  const [break3Start, setBreak3Start] = useState(practitioner.break3Start ?? '18:00')
  const [break3End, setBreak3End] = useState(practitioner.break3End ?? '18:15')
  const [saving, setSaving] = useState(false)
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [syncEnabled, setSyncEnabled] = useState(practitioner.googleCalendar?.syncEnabled ?? true)
  const [includeCustomerDetails, setIncludeCustomerDetails] = useState(practitioner.googleCalendar?.includeCustomerDetails ?? false)

  async function updateCalendarSettings() {
    setCalendarBusy(true)
    try {
      const response = await fetchWithTimeout('/api/google-calendar/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ practitionerId: practitioner.id, syncEnabled, includeCustomerDetails }) })
      if (!response.ok) throw new Error()
      onSaved()
    } catch { alert('Setările Google Calendar nu au putut fi salvate.') } finally { setCalendarBusy(false) }
  }

  async function syncCalendar() {
    setCalendarBusy(true)
    try {
      const response = await fetchWithTimeout('/api/google-calendar/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ practitionerId: practitioner.id }) })
      if (!response.ok) throw new Error()
      const data = await response.json(); alert(`${data.count} programări au fost verificate și sincronizate.`); onSaved()
    } catch { alert('Sincronizarea Google Calendar a eșuat.') } finally { setCalendarBusy(false) }
  }

  async function disconnectCalendar() {
    if (!confirm('Deconectezi Google Calendar? Evenimentele deja create vor rămâne în calendar.')) return
    setCalendarBusy(true)
    try {
      const response = await fetchWithTimeout(`/api/google-calendar/settings?practitionerId=${encodeURIComponent(practitioner.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(); onSaved()
    } catch { alert('Deconectarea a eșuat.') } finally { setCalendarBusy(false) }
  }

  function hourFor(weekday: number) {
    return hours.find((h) => h.weekday === weekday)
  }

  function toggleDay(weekday: number, enabled: boolean) {
    if (enabled) {
      setHours((prev) => [...prev, { weekday, startTime: '09:00', endTime: '17:00' }])
    } else {
      setHours((prev) => prev.filter((h) => h.weekday !== weekday))
    }
  }

  function updateHour(weekday: number, patch: Partial<WorkingHour>) {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)))
  }

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  async function save() {
    setSaving(true)
    try {
      await fetchWithTimeout(`/api/business/practitioners/${practitioner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active,
          workingHours: hours,
          serviceIds,
          break1Start: break1Enabled ? break1Start : null,
          break1End: break1Enabled ? break1End : null,
          break2Start: break2Enabled ? break2Start : null,
          break2End: break2Enabled ? break2End : null,
          break3Start: break3Enabled ? break3Start : null,
          break3End: break3Enabled ? break3End : null,
        }),
      })
      onSaved()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Activ (poate primi programări)
      </label>

      <div>
        <p className="text-sm font-medium mb-2">Program</p>
        <div className="flex flex-col gap-1.5">
          {WEEKDAY_ORDER.map((weekday) => {
            const h = hourFor(weekday)
            return (
              <div key={weekday} className="flex flex-wrap items-center gap-2 text-sm py-1">
                <label className="flex items-center gap-1.5 text-gray-500 w-28 shrink-0">
                  <input type="checkbox" checked={!!h} onChange={(e) => toggleDay(weekday, e.target.checked)} />
                  {WEEKDAY_LABELS[weekday]}
                </label>
                {h && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Time10Select value={h.startTime} onChange={(value) => updateHour(weekday, { startTime: value })} />
                    <span className="text-gray-400">–</span>
                    <Time10Select value={h.endTime} onChange={(value) => updateHour(weekday, { endTime: value })} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Pauze</p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-gray-500 w-24 shrink-0">
              <input type="checkbox" checked={break1Enabled} onChange={(e) => setBreak1Enabled(e.target.checked)} />
              Pauza 1
            </label>
            {break1Enabled && (
              <div className="flex items-center gap-2">
                <Time10Select value={break1Start} onChange={setBreak1Start} />
                <span className="text-gray-400">–</span>
                <Time10Select value={break1End} onChange={setBreak1End} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-gray-500 w-24 shrink-0">
              <input type="checkbox" checked={break2Enabled} onChange={(e) => setBreak2Enabled(e.target.checked)} />
              Pauza 2
            </label>
            {break2Enabled && (
              <div className="flex items-center gap-2">
                <Time10Select value={break2Start} onChange={setBreak2Start} />
                <span className="text-gray-400">–</span>
                <Time10Select value={break2End} onChange={setBreak2End} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-gray-500 w-24 shrink-0">
              <input type="checkbox" checked={break3Enabled} onChange={(e) => setBreak3Enabled(e.target.checked)} />
              Pauza 3
            </label>
            {break3Enabled && (
              <div className="flex items-center gap-2">
                <Time10Select value={break3Start} onChange={setBreak3Start} />
                <span className="text-gray-400">–</span>
                <Time10Select value={break3End} onChange={setBreak3End} />
              </div>
            )}
          </div>
        </div>
      </div>

      {services.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Servicii oferite</p>
          <p className="text-xs text-gray-400 mb-2">Dacă nu bifezi niciunul, se consideră că oferă toate serviciile.</p>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleService(s.id)}
                className="text-sm px-3 py-1.5 rounded-full border"
                style={
                  serviceIds.includes(s.id)
                    ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
                    : {}
                }
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border-soft)] p-4">
        <p className="text-sm font-medium mb-1">Google Calendar</p>
        {!practitioner.googleCalendar ? (
          <>
            <p className="text-xs text-gray-500 mb-3">Programările vor apărea automat într-un calendar separat, numai pentru vizualizare. BookEasy rămâne sursa oficială.</p>
            <a href={`/api/google-calendar/connect?practitionerId=${encodeURIComponent(practitioner.id)}`} className="btn-primary inline-flex text-sm">Conectează contul Google</a>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-gray-500"><span className="font-medium text-gray-700">{practitioner.googleCalendar.calendarName}</span>{practitioner.googleCalendar.googleEmail ? ` · ${practitioner.googleCalendar.googleEmail}` : ''}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={syncEnabled} onChange={(e) => setSyncEnabled(e.target.checked)} /> Sincronizare automată activă</label>
            <label className="flex items-start gap-2 text-sm"><input className="mt-0.5" type="checkbox" checked={includeCustomerDetails} onChange={(e) => setIncludeCustomerDetails(e.target.checked)} /><span>Include numele, telefonul și serviciul clientului <span className="block text-xs text-gray-400">Pentru clinici recomandăm să rămână dezactivat.</span></span></label>
            {practitioner.googleCalendar.lastError && <p className="text-xs text-red-600">Necesită atenție: {practitioner.googleCalendar.lastError}</p>}
            {practitioner.googleCalendar.lastSyncAt && !practitioner.googleCalendar.lastError && <p className="text-xs text-emerald-600">Sincronizat: {new Date(practitioner.googleCalendar.lastSyncAt).toLocaleString('ro-RO')}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={updateCalendarSettings} disabled={calendarBusy}>Salvează setările</Button>
              <button className="text-sm px-3" onClick={syncCalendar} disabled={calendarBusy}>Sincronizează programările existente</button>
              <button className="text-sm px-3 text-red-600" onClick={disconnectCalendar} disabled={calendarBusy}>Deconectează</button>
            </div>
          </div>
        )}
      </div>

      <Button onClick={save} disabled={saving} className="self-start">
        {saving ? 'Se salvează...' : 'Salvează modificările'}
      </Button>
    </div>
  )
}
