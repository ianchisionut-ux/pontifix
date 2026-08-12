'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'
import { Phone, Stethoscope, CheckCircle2, Clock, X } from 'lucide-react'

export type BookingDetail = {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  serviceName: string
  practitionerName?: string | null
  startAt: string
  endAt: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'
  confirmationRequestSent?: boolean
  customerConfirmed?: boolean | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'În așteptare',
  CONFIRMED: 'Confirmată',
  CANCELLED: 'Anulată',
  COMPLETED: 'Finalizată',
  NO_SHOW: 'Neprezentare',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'neutral',
  NO_SHOW: 'danger',
}

function buildWorkingTimeOptions(dateValue: string, workingHours: { weekday: number; startTime: string; endTime: string }[], durationMinutes: number, stepMinutes: number) {
  if (!dateValue) return []
  const weekday = new Date(`${dateValue}T12:00:00`).getDay()
  const options: string[] = []
  for (const range of workingHours.filter((item) => item.weekday === weekday)) {
    const [startHour, startMinute] = range.startTime.split(':').map(Number)
    const [endHour, endMinute] = range.endTime.split(':').map(Number)
    let cursor = Math.ceil((startHour * 60 + startMinute) / stepMinutes) * stepMinutes
    const end = endHour * 60 + endMinute
    while (cursor + durationMinutes <= end) {
      options.push(`${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`)
      cursor += stepMinutes
    }
  }
  return [...new Set(options)]
}

export default function BookingEditModal({
  booking,
  isAppointmentBased,
  onClose,
  workingHours,
  stepMinutes,
}: {
  booking: BookingDetail
  isAppointmentBased: boolean
  onClose: () => void
  workingHours: { weekday: number; startTime: string; endTime: string }[]
  stepMinutes: number
}) {
  const router = useRouter()
  const [status, setStatus] = useState(booking.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingPatient, setEditingPatient] = useState(false)
  const [patientName, setPatientName] = useState(booking.customerName)
  const [patientPhone, setPatientPhone] = useState(booking.customerPhone)
  const [savingPatient, setSavingPatient] = useState(false)

  async function savePatientInfo() {
    setSavingPatient(true)
    try {
      const res = await fetchWithTimeout(`/api/customers/${booking.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: patientName, phone: patientPhone }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Nu am putut salva datele.')
        return
      }
      setEditingPatient(false)
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSavingPatient(false)
    }
  }

  function formatDateInput(iso: string) {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [startAt, setStartAt] = useState(formatDateInput(booking.startAt))
  const selectedDate = startAt.split('T')[0] ?? ''
  const selectedTime = startAt.split('T')[1] ?? ''
  const durationMinutes = Math.max(1, Math.round((new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) / 60000))
  const availableTimes = buildWorkingTimeOptions(selectedDate, workingHours, durationMinutes, stepMinutes)

  async function save() {
    setSaving(true)
    setError('')
    const durationMs = new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()
    const newStart = new Date(startAt)
    const newEnd = new Date(newStart.getTime() + durationMs)

    if (!availableTimes.includes(selectedTime)) {
      setError('Alege o oră din programul de lucru setat pentru această zi.')
      setSaving(false)
      return
    }

    try {
      const res = await fetchWithTimeout(`/api/business/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Nu am putut salva modificările.')
        return
      }

      router.refresh()
      onClose()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  async function cancelBooking() {
    if (!confirm(`Anulezi această ${isAppointmentBased ? 'programare' : 'rezervare'}?`)) return
    setSaving(true)
    try {
      await fetchWithTimeout(`/api/business/bookings/${booking.id}`, { method: 'DELETE' })
      router.refresh()
      onClose()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/25 flex justify-end z-50" onClick={onClose}>
      <Card className="calendar-drawer w-full max-w-md h-full max-h-none overflow-y-auto rounded-none p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Detalii {isAppointmentBased ? 'programare' : 'rezervare'}</p><h2 className="text-xl font-semibold">{booking.serviceName}</h2></div>
          <button onClick={onClose} className="w-9 h-9 rounded-full border border-[var(--border-soft)] flex items-center justify-center" aria-label="Închide"><X size={18}/></button>
        </div>
        <div className="mb-5 rounded-2xl bg-[var(--surface-muted)] p-4">
          <div className="flex justify-end mb-2"><Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill></div>
          {editingPatient ? (
            <div className="flex flex-col gap-2">
              <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Nume" className="input-field w-full text-sm" />
              <input type="tel" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="Telefon" className="input-field w-full text-sm" />
              <div className="flex gap-2">
                <button onClick={savePatientInfo} disabled={savingPatient} className="text-xs text-[var(--accent)] font-medium">
                  {savingPatient ? 'Se salvează...' : 'Salvează'}
                </button>
                <button onClick={() => setEditingPatient(false)} className="text-xs text-gray-500">
                  Anulează
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700 font-medium">{booking.customerName}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone size={12} /> {booking.customerPhone || 'Telefon necompletat'}
                  {booking.practitionerName && (
                    <>
                      {' '}· <Stethoscope size={12} className="inline" /> {booking.practitionerName}
                    </>
                  )}
                </p>
                {booking.confirmationRequestSent && booking.status === 'CONFIRMED' && (
                  <p
                    className="text-xs mt-0.5 flex items-center gap-1"
                    style={{ color: booking.customerConfirmed ? '#16a34a' : '#eab308' }}
                  >
                    {booking.customerConfirmed ? (
                      <>
                        <CheckCircle2 size={12} /> Confirmată de client
                      </>
                    ) : (
                      <>
                        <Clock size={12} /> Așteaptă confirmare de la client
                      </>
                    )}
                  </p>
                )}
              </div>
              <button onClick={() => setEditingPatient(true)} className="text-xs text-[var(--accent)] font-medium">
                Editează
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Data și ora</label>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const nextTimes = buildWorkingTimeOptions(e.target.value, workingHours, durationMinutes, stepMinutes)
                  setStartAt(e.target.value && nextTimes[0] ? `${e.target.value}T${nextTimes[0]}` : e.target.value)
                }}
                className="input-field w-full"
                aria-label={`Data ${isAppointmentBased ? 'programării' : 'rezervării'}`}
              />
              <select
                value={selectedTime}
                onChange={(e) => setStartAt(selectedDate ? `${selectedDate}T${e.target.value}` : '')}
                className="input-field w-full"
                aria-label={`Ora ${isAppointmentBased ? 'programării' : 'rezervării'} în format 24 de ore`}
              >
                <option value="">Ora</option>
                {availableTimes.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            {availableTimes.length === 0 && <p className="text-xs text-amber-700 mt-1.5">Profilul nu are program de lucru în această zi.</p>}
          </div>

          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="input-field w-full">
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="flex justify-between mt-5">
          <button onClick={cancelBooking} disabled={saving} className="text-sm text-red-600 font-medium">
            {isAppointmentBased ? 'Anulează programarea' : 'Anulează rezervarea'}
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Închide
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Se salvează...' : 'Salvează'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
