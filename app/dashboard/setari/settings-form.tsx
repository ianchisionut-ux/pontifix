'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Time10Select } from '@/components/working-date-time-picker'

const WEEKDAY_LABELS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']

type WorkingHour = { weekday: number; startTime: string; endTime: string; closed: boolean }

export default function SettingsForm({
  business,
  workingHours,
  isMultiPractitioner,
  isClinic,
  isEventVenue,
}: {
  business: {
    name: string
    contactPhone: string
    city: string
    address: string
    publicListed: boolean
    slotIntervalMinutes: number | null
    minLeadTimeMinutes: number
    reminderMinutesBefore: number
    operatorSilenceMinutes: number
    botBookingEnabled: boolean
    break1Start: string | null
    break1End: string | null
    break2Start: string | null
    break2End: string | null
    break3Start: string | null
    break3End: string | null
  }
  workingHours: WorkingHour[]
  isMultiPractitioner: boolean
  isClinic: boolean
  isEventVenue: boolean
}) {
  const [form, setForm] = useState(business)
  const usesAppointments = !isEventVenue
  const [saveSlot, setSaveSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setSaveSlot(document.getElementById('settings-save-slot'))
  }, [])
  const [hours, setHours] = useState(workingHours)
  const initialNonStop = workingHours.every((hour) => !hour.closed && hour.startTime === '00:00' && hour.endTime === '23:59')
  const [nonStop, setNonStop] = useState(initialNonStop)
  const previousHours = useRef<WorkingHour[]>(initialNonStop
    ? workingHours.map((hour) => ({ ...hour, startTime: '09:00', endTime: '18:00', closed: hour.weekday === 0 || hour.weekday === 6 }))
    : workingHours)
  const [break1Enabled, setBreak1Enabled] = useState(!!business.break1Start)
  const [break2Enabled, setBreak2Enabled] = useState(!!business.break2Start)
  const [break3Enabled, setBreak3Enabled] = useState(!!business.break3Start)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [geocoded, setGeocoded] = useState(false)

  function updateHour(weekday: number, patch: Partial<WorkingHour>) {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)))
  }

  function toggleNonStop(enabled: boolean) {
    setNonStop(enabled)
    if (enabled) {
      previousHours.current = hours
      setHours(hours.map((hour) => ({ ...hour, startTime: '00:00', endTime: '23:59', closed: false })))
    } else {
      setHours(previousHours.current)
    }
  }

  function toggleBreak(index: 1 | 2 | 3, enabled: boolean) {
    if (index === 1) setBreak1Enabled(enabled)
    if (index === 2) setBreak2Enabled(enabled)
    if (index === 3) setBreak3Enabled(enabled)
    if (!enabled) return

    setForm((current) => {
      if (index === 1) return { ...current, break1Start: current.break1Start ?? '13:00', break1End: current.break1End ?? '14:00' }
      if (index === 2) return { ...current, break2Start: current.break2Start ?? '16:00', break2End: current.break2End ?? '16:20' }
      return { ...current, break3Start: current.break3Start ?? '18:00', break3End: current.break3End ?? '18:20' }
    })
  }

  async function handleSave() {
    setSaving(true)
    setGeocoded(false)
    try {
      const res = await fetch('/api/business/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          slotIntervalMinutes: form.slotIntervalMinutes,
          workingHours: hours,
          break1Start: break1Enabled ? form.break1Start : null,
          break1End: break1Enabled ? form.break1End : null,
          break2Start: break2Enabled ? form.break2Start : null,
          break2End: break2Enabled ? form.break2End : null,
          break3Start: break3Enabled ? form.break3Start : null,
          break3End: break3Enabled ? form.break3End : null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedAt(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' }))
        setGeocoded(!!data.geocoded)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card className="mb-5 break-inside-avoid">
        <h2 className="font-medium mb-4">Date profil</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Nume profil</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Telefon contact</label>
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Oraș</label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Adresă</label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card className="mb-5 break-inside-avoid">
        <h2 className="font-medium mb-4">Program de lucru</h2>
        {isEventVenue && (
          <label className="mb-4 flex items-start gap-3 rounded-2xl border border-[var(--border-soft)] p-3 cursor-pointer">
            <input type="checkbox" checked={nonStop} onChange={(event) => toggleNonStop(event.target.checked)} className="mt-1" />
            <span>
              <strong className="text-sm block">Non-stop</strong>
              <span className="text-xs text-gray-500">Sala poate fi rezervată la orice oră, iar evenimentul poate continua după miezul nopții.</span>
            </span>
          </label>
        )}
        <div className="flex flex-col gap-2 mb-5">
          {hours.map((h) => (
            <div key={h.weekday} className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm py-1">
              <span className="w-20 sm:w-24 text-gray-600 shrink-0">{WEEKDAY_LABELS[h.weekday]}</span>
              <label className="flex items-center gap-1.5 text-gray-500 shrink-0">
                <input
                  type="checkbox"
                  checked={!h.closed}
                  disabled={nonStop}
                  onChange={(e) => updateHour(h.weekday, { closed: !e.target.checked })}
                />
                deschis
              </label>
              {!h.closed && !nonStop && (
                <div className="flex items-center gap-2 shrink-0">
                  <Time10Select value={h.startTime} onChange={(value) => updateHour(h.weekday, { startTime: value })} />
                  <span className="text-gray-400">–</span>
                  <Time10Select value={h.endTime} onChange={(value) => updateHour(h.weekday, { endTime: value })} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-[var(--border-soft)]">
          {isMultiPractitioner ? (
            <p className="text-sm text-gray-500">
              Profilul e setat pe "Echipă" — fiecare medic/angajat își setează propriile pauze din{' '}
              <a href="/dashboard/medici" className="text-[var(--accent)] underline">
                Medici
              </a>
              , unde știu cel mai bine când au pauză pe calendarul lor.
            </p>
          ) : (
            <>
              <h3 className="text-sm font-medium mb-1">Pauze</h3>
              <p className="text-xs text-gray-500 mb-3">
                Aceleași ore în fiecare zi lucrătoare — nu se pot face {usesAppointments ? 'programări' : 'rezervări'} în aceste intervale.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5 text-gray-500 w-24 shrink-0">
                    <input type="checkbox" checked={break1Enabled} onChange={(e) => toggleBreak(1, e.target.checked)} />
                    Pauza 1
                  </label>
                  {break1Enabled && (
                    <div className="flex items-center gap-2">
                      <Time10Select value={form.break1Start ?? '13:00'} onChange={(value) => setForm({ ...form, break1Start: value })} />
                      <span className="text-gray-400">–</span>
                      <Time10Select value={form.break1End ?? '14:00'} onChange={(value) => setForm({ ...form, break1End: value })} />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5 text-gray-500 w-24 shrink-0">
                    <input type="checkbox" checked={break2Enabled} onChange={(e) => toggleBreak(2, e.target.checked)} />
                    Pauza 2
                  </label>
                  {break2Enabled && (
                    <div className="flex items-center gap-2">
                      <Time10Select value={form.break2Start ?? '16:00'} onChange={(value) => setForm({ ...form, break2Start: value })} />
                      <span className="text-gray-400">–</span>
                      <Time10Select value={form.break2End ?? '16:20'} onChange={(value) => setForm({ ...form, break2End: value })} />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5 text-gray-500 w-24 shrink-0">
                    <input type="checkbox" checked={break3Enabled} onChange={(e) => toggleBreak(3, e.target.checked)} />
                    Pauza 3
                  </label>
                  {break3Enabled && (
                    <div className="flex items-center gap-2">
                      <Time10Select value={form.break3Start ?? '18:00'} onChange={(value) => setForm({ ...form, break3Start: value })} />
                      <span className="text-gray-400">–</span>
                      <Time10Select value={form.break3End ?? '18:20'} onChange={(value) => setForm({ ...form, break3End: value })} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card className="mb-5 break-inside-avoid">
        <h2 className="font-medium mb-1">Interval între ore disponibile</h2>
        <p className="text-sm text-gray-500 mb-3">
          Cum se împart orele oferite {isClinic ? 'pacienților' : 'clienților'} la {usesAppointments ? 'programare' : 'rezervare'}.
        </p>
        <select
          value={form.slotIntervalMinutes ?? ''}
          onChange={(e) => setForm({ ...form, slotIntervalMinutes: e.target.value ? Number(e.target.value) : null })}
          className="input-field w-full"
        >
          <option value="">Automat, după durata serviciilor (recomandat)</option>
          <option value="5">Minimum 5 minute</option>
          <option value="10">Minimum 10 minute</option>
          <option value="15">Din 15 în 15 minute</option>
          <option value="20">Din 20 în 20 minute</option>
          <option value="30">Din 30 în 30 minute</option>
          <option value="60">Din oră în oră</option>
        </select>
        <p className="text-xs text-gray-400 mt-2">
          Automat, Pontifix combină duratele serviciilor profilului pentru a reduce golurile. O valoare manuală
          poate face orele mai rare, dar sistemul nu va fragmenta programul sub pasul util al serviciilor.
        </p>
      </Card>

      <Card className="mb-5 break-inside-avoid">
        <h2 className="font-medium mb-1">Interval minim pentru {usesAppointments ? 'programări' : 'rezervări'} din exterior</h2>
        <p className="text-sm text-gray-500 mb-3">
          {usesAppointments ? 'Programările venite' : 'Rezervările venite'} prin bot (WhatsApp/Instagram/Facebook) sau de pe site nu se pot face
          mai aproape de acest interval — ca să ai timp să vezi {usesAppointments ? 'programările' : 'rezervările'}. La fel și anulările
          făcute de {isClinic ? 'pacienți' : 'clienți'}. {usesAppointments ? 'Programările create' : 'Rezervările create'} manual de tine din dashboard nu sunt afectate — le
          poți face oricând, chiar cu 30 de minute înainte.
        </p>
        <select
          value={form.minLeadTimeMinutes}
          onChange={(e) => setForm({ ...form, minLeadTimeMinutes: Number(e.target.value) })}
          className="input-field w-full"
        >
          <option value="60">Minim 1 oră înainte</option>
          <option value="90">Minim 1 oră 30 min înainte</option>
          <option value="120">Minim 2 ore înainte (recomandat)</option>
          <option value="180">Minim 3 ore înainte</option>
        </select>
      </Card>

      <Card className="mb-5 break-inside-avoid">
        <h2 className="font-medium mb-1">Reconfirmare {usesAppointments ? 'programări' : 'rezervări'} pe WhatsApp</h2>
        <p className="text-sm text-gray-500">
          Orice {usesAppointments ? 'programare' : 'rezervare'} nouă intră în sistem ca <strong>"În așteptare"</strong> — {isClinic ? 'pacientul' : 'clientul'} primește
          automat, cu o zi înainte, la ora <strong>16:00</strong>, un mesaj cu detaliile {usesAppointments ? 'programării' : 'rezervării'} și
          butoane de confirmare/anulare. Devine "Confirmată" abia după ce apasă. Mai primește și un
          reminder scurt, cu 1 oră înainte de {usesAppointments ? 'programare' : 'rezervare'}, în ziua respectivă. Fix, nu e configurabil.
        </p>
      </Card>

      <Card className="mb-5 break-inside-avoid">
        <h2 className="font-medium mb-1">Tăcere bot după cerere de operator</h2>
        <p className="text-sm text-gray-500 mb-3">
          Când un client apasă "Operator" în conversația de pe WhatsApp/Messenger, botul nu mai
          răspunde deloc pentru acest interval — ca să poți prelua tu conversația fără suprapuneri.
          După ce trece timpul, botul revine automat la răspunsuri normale.
        </p>
        <select
          value={form.operatorSilenceMinutes}
          onChange={(e) => setForm({ ...form, operatorSilenceMinutes: Number(e.target.value) })}
          className="input-field w-full"
        >
          <option value="15">15 minute</option>
          <option value="30">30 de minute (recomandat)</option>
          <option value="60">1 oră</option>
          <option value="120">2 ore</option>
          <option value="240">4 ore</option>
        </select>
      </Card>

      <Card className="mb-5 break-inside-avoid">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">{usesAppointments ? 'Programare' : 'Rezervare'} direct în conversație (bot)</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Dacă e oprit, opțiunea "{usesAppointments ? 'Fă o programare' : 'Fă o rezervare'}" dispare din meniul de start al botului —
              rămân doar "Vorbește cu un operator" și "Vezi pagina de rezervare". Util dacă vrei ca
              toate {usesAppointments ? 'programările' : 'rezervările'} din WhatsApp/Messenger să treacă prin pagina publică, nu prin bot.
            </p>
          </div>
          <button
            onClick={() => setForm({ ...form, botBookingEnabled: !form.botBookingEnabled })}
            className="pill w-11 h-6 flex items-center px-0.5 transition shrink-0 ml-4"
            style={{ background: form.botBookingEnabled ? 'var(--accent)' : '#e5e5ea' }}
          >
            <span
              className="pill w-5 h-5 bg-white transition-transform"
              style={{ transform: form.botBookingEnabled ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
        </div>
      </Card>

      <Card className="mb-5 break-inside-avoid">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">Vizibil pe harta publică</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Afacerea apare pe hartă și pe pagina publică Pontifix
            </p>
          </div>
          <button
            onClick={() => setForm({ ...form, publicListed: !form.publicListed })}
            className="pill w-11 h-6 flex items-center px-0.5 transition"
            style={{ background: form.publicListed ? 'var(--accent)' : '#e5e5ea' }}
          >
            <span
              className="pill w-5 h-5 bg-white transition-transform"
              style={{ transform: form.publicListed ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
        </div>
      </Card>

      {saveSlot &&
        createPortal(
          <>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Se salvează...' : 'Salvează setările'}
            </Button>
            {savedAt && <span className="text-xs text-gray-500 whitespace-nowrap">Salvat la {savedAt}</span>}
            {geocoded && <span className="text-xs text-green-700 whitespace-nowrap">· locația a fost actualizată pe hartă</span>}
          </>,
          saveSlot
        )}
    </>
  )
}
