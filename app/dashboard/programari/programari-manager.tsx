'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/input'
import { PrintButton } from '@/components/print-button'
import { CheckCircle2, Clock } from 'lucide-react'
import { WorkingDateTimePicker, WorkingRange } from '@/components/working-date-time-picker'

type Booking = {
  id: string
  sequenceNumber: number | null
  customerName: string
  customerPhone: string
  customerId: string
  serviceName: string
  serviceId: string
  resourceName: string | null
  practitionerName: string | null
  startAt: string
  endAt: string
  status: string
  channel: string
  confirmationRequestSent: boolean
  customerConfirmed: boolean | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'În așteptare',
  CONFIRMED: 'Confirmată',
  CANCELLED: 'Anulată',
  COMPLETED: 'Finalizată',
  NO_SHOW: 'Neprezentare',
}

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  GOOGLE_BUSINESS: 'Google',
  WEB: 'Site',
  MANUAL: 'Manual',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'neutral',
  NO_SHOW: 'danger',
}

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: '#16a34a',
  PENDING: '#eab308',
  CANCELLED: '#ef4444',
  COMPLETED: '#6b7280',
  NO_SHOW: '#ef4444',
}

// Saloanele și clinicile au servicii cu durată fixă (Telefon), spațiile de evenimente
// au săli/resurse (Sală) — dimensiune independentă de teamSize
function isAppointmentBased(category: string) {
  return category === 'SALON' || category === 'CLINICA'
}

function SortableHeader({
  label,
  column,
  sortColumn,
  sortAsc,
  onClick,
}: {
  label: string
  column: SortColumn
  sortColumn: SortColumn | null
  sortAsc: boolean
  onClick: () => void
}) {
  const active = sortColumn === column
  return (
    <th
      onClick={onClick}
      className="font-medium text-gray-500 cursor-pointer select-none hover:text-[var(--foreground)]"
    >
      {label} {active && (sortAsc ? '↑' : '↓')}
    </th>
  )
}

export default function ProgramariManager({
  category,
  isMultiPractitioner,
  bookings,
  customers,
  services,
  blockedSlots,
  practitioners,
  workingHours,
  slotIntervalMinutes,
  filters,
  newlyConfirmedIds,
}: {
  category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'
  isMultiPractitioner: boolean
  bookings: Booking[]
  customers: { id: string; name: string }[]
  services: { id: string; name: string; durationMin: number | null }[]
  blockedSlots: { startAt: string; endAt: string }[]
  practitioners: { id: string; name: string }[]
  workingHours: WorkingRange[]
  slotIntervalMinutes: number
  filters: { status: string; q: string }
  newlyConfirmedIds: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [adding, setAdding] = useState(searchParams.get('add') === '1')
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null)
  const [sendingConfirmId, setSendingConfirmId] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortAsc((v) => !v)
    } else {
      setSortColumn(column)
      setSortAsc(true)
    }
  }
  const isClinic = category === 'CLINICA'
  const appointmentBased = isAppointmentBased(category)
  const bookingPlural = appointmentBased ? 'programări' : 'rezervări'
  const bookingSingular = appointmentBased ? 'programare' : 'rezervare'
  const customerSingular = isClinic ? 'pacient' : 'client'
  // 8 coloane (fără Sală/Medic) sau 9 (cu Sală sau Medic)
  const colCount = appointmentBased && !isMultiPractitioner ? 8 : 9

  async function changeStatus(id: string, status: string) {
    try {
      const res = await fetchWithTimeout(`/api/business/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Nu am putut actualiza statusul.')
        return
      }
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  async function cancelBooking(id: string) {
    if (!confirm(`Anulezi această ${bookingSingular}?`)) return
    try {
      await fetchWithTimeout(`/api/business/bookings/${id}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  async function deletePermanently(id: string) {
    if (!confirm(`Ștergi definitiv această ${bookingSingular}? Nu se mai poate anula acțiunea — dispare complet, inclusiv din istoric.`)) return
    try {
      const res = await fetchWithTimeout(`/api/business/bookings/${id}/delete-permanently`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Nu am putut șterge.')
        return
      }
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  async function sendReminder(id: string) {
    setSendingReminderId(id)
    try {
      const res = await fetchWithTimeout(`/api/business/bookings/${id}/send-reminder`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error ?? 'Nu am putut trimite reminder-ul.')
        return
      }
      alert('Reminder trimis pe WhatsApp!')
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSendingReminderId(null)
    }
  }

  async function sendConfirmationRequest(id: string) {
    setSendingConfirmId(id)
    try {
      const res = await fetchWithTimeout(`/api/business/bookings/${id}/send-confirmation-request`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error ?? 'Nu am putut trimite cererea de confirmare.')
        return
      }
      alert('Cerere de confirmare trimisă — clientul poate confirma sau anula direct din WhatsApp.')
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSendingConfirmId(null)
    }
  }

  function renderRow(b: Booking) {
    const isNewlyConfirmed = newlyConfirmedIds.includes(b.id)
    return (
      <tr
        key={b.id}
        className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--surface-muted)]"
        style={isNewlyConfirmed ? { background: 'rgba(34, 197, 94, 0.07)' } : {}}
      >
        <td className="py-3 px-5 text-gray-400 font-mono text-xs">
          {b.sequenceNumber ? `#${String(b.sequenceNumber).padStart(3, '0')}` : '—'}
        </td>
        <td className="font-medium">
          <a href={`/dashboard/clienti/${b.customerId}`} className="text-[var(--accent)] hover:underline">
            {b.customerName}
          </a>
        </td>
        <td>{b.serviceName}</td>
        <td className="text-gray-500">{new Date(b.startAt).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short', hour12: false, timeZone: 'Europe/Bucharest' })}</td>
        {isMultiPractitioner ? (
          <>
            <td className="text-gray-500">{b.practitionerName ?? '—'}</td>
            <td className="text-gray-500">{b.customerPhone}</td>
          </>
        ) : appointmentBased ? (
          <td className="text-gray-500">{b.customerPhone}</td>
        ) : (
          <>
            <td className="text-gray-500">{b.resourceName ?? '—'}</td>
            <td className="text-gray-500">{b.customerPhone}</td>
          </>
        )}
        <td className="text-gray-500">{CHANNEL_LABEL[b.channel] ?? b.channel}</td>
        <td>
          <div className="flex items-center gap-1.5">
            <select
              value={b.status}
              onChange={(e) => changeStatus(b.id, e.target.value)}
              className="text-xs py-1 px-2 rounded-full font-medium border-0"
              style={{ backgroundColor: `${STATUS_COLOR[b.status]}20`, color: STATUS_COLOR[b.status] }}
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {b.confirmationRequestSent && b.status === 'CONFIRMED' && (
              <span title={b.customerConfirmed ? 'Confirmată de client' : 'Așteaptă confirmare de la client'}>
                {b.customerConfirmed ? <CheckCircle2 size={13} color="#16a34a" /> : <Clock size={13} color="#eab308" />}
              </span>
            )}
          </div>
        </td>
        <td className="pr-5 text-right whitespace-nowrap">
          {b.status === 'PENDING' && (
            <button
              onClick={() => sendConfirmationRequest(b.id)}
              disabled={sendingConfirmId === b.id}
              className="text-xs text-[var(--accent)] font-medium mr-3"
            >
              {sendingConfirmId === b.id ? 'Se trimite...' : 'Cere reconfirmare'}
            </button>
          )}
          {b.status === 'CONFIRMED' && (
            <button
              onClick={() => sendReminder(b.id)}
              disabled={sendingReminderId === b.id}
              className="text-xs text-[var(--accent)] font-medium mr-3"
            >
              {sendingReminderId === b.id ? 'Se trimite...' : 'Reminder'}
            </button>
          )}
          {b.status !== 'CANCELLED' && (
            <button onClick={() => cancelBooking(b.id)} className="text-xs text-red-600 font-medium mr-3">
              Anulează
            </button>
          )}
          <button onClick={() => deletePermanently(b.id)} className="text-xs text-gray-400 font-medium">
            Șterge definitiv
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <h1 className="text-2xl font-semibold mr-1">{appointmentBased ? 'Programări' : 'Rezervări'}</h1>
        <span className="text-sm text-gray-500 mr-1 whitespace-nowrap">{bookings.length} {bookingPlural}</span>
        <form method="get" className="contents">
          <Input name="q" defaultValue={filters.q} placeholder={`Caută ${customerSingular}...`} className="w-40" />
          <select name="status" defaultValue={filters.status} className="input-field">
            <option value="">Toate statusurile</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary whitespace-nowrap">
            Filtrează
          </button>
        </form>
        <PrintButton />
        <Button onClick={() => setAdding((v) => !v)}>{adding ? 'Anulează' : `+ Adaugă ${bookingSingular}`}</Button>
      </div>

      {adding && (
        <NewBookingForm
          category={category}
          isMultiPractitioner={isMultiPractitioner}
          customers={customers}
          services={services}
          blockedSlots={blockedSlots}
          practitioners={practitioners}
          workingHours={workingHours}
          slotIntervalMinutes={slotIntervalMinutes}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      )}

      <Card className="p-0 overflow-hidden printable">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left border-b border-[var(--border-soft)]">
              <SortableHeader label="#" column="sequenceNumber" sortColumn={sortColumn} sortAsc={sortAsc} onClick={() => toggleSort('sequenceNumber')} />
              <SortableHeader label={isClinic ? 'Pacient' : 'Client'} column="customerName" sortColumn={sortColumn} sortAsc={sortAsc} onClick={() => toggleSort('customerName')} />
              <SortableHeader label="Serviciu" column="serviceName" sortColumn={sortColumn} sortAsc={sortAsc} onClick={() => toggleSort('serviceName')} />
              <SortableHeader label="Data" column="startAt" sortColumn={sortColumn} sortAsc={sortAsc} onClick={() => toggleSort('startAt')} />
              {isMultiPractitioner ? (
                <>
                  <SortableHeader label="Medic" column="practitionerName" sortColumn={sortColumn} sortAsc={sortAsc} onClick={() => toggleSort('practitionerName')} />
                  <SortableHeader label="Telefon" column="customerPhone" sortColumn={sortColumn} sortAsc={sortAsc} onClick={() => toggleSort('customerPhone')} />
                </>
              ) : appointmentBased ? (
                <SortableHeader label="Telefon" column="customerPhone" sortColumn={sortColumn} sortAsc={sortAsc} onClick={() => toggleSort('customerPhone')} />
              ) : (
                <>
                  <th className="font-medium text-gray-500">Sală</th>
                  <SortableHeader label="Telefon" column="customerPhone" sortColumn={sortColumn} sortAsc={sortAsc} onClick={() => toggleSort('customerPhone')} />
                </>
              )}
              <SortableHeader label="Canal" column="channel" sortColumn={sortColumn} sortAsc={sortAsc} onClick={() => toggleSort('channel')} />
              <SortableHeader label="Status" column="status" sortColumn={sortColumn} sortAsc={sortAsc} onClick={() => toggleSort('status')} />
              <th className="font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {sortColumn
              ? sortBookings(bookings, sortColumn, sortAsc).map((b) => renderRow(b))
              : groupByWeek(bookings).map((group) => (
                  <Fragment key={`week-${group.year}-${group.week}`}>
                    <tr key={`week-${group.week}-${group.year}`} className="bg-[var(--surface-muted)]">
                      <td colSpan={colCount} className="px-5 py-2 text-xs font-semibold text-gray-500">
                        Săptămâna {group.week} · {group.rangeLabel} ({group.bookings.length} {bookingPlural})
                      </td>
                    </tr>
                    {group.bookings.map((b) => renderRow(b))}
                  </Fragment>
                ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={colCount} className="text-center text-gray-500 py-8">
                  Nicio {bookingSingular} găsită.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  )
}

type SortColumn = 'sequenceNumber' | 'customerName' | 'serviceName' | 'startAt' | 'practitionerName' | 'customerPhone' | 'channel' | 'status'

function sortBookings(bookings: Booking[], column: SortColumn, asc: boolean): Booking[] {
  const sorted = [...bookings].sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (column === 'sequenceNumber') {
      av = a.sequenceNumber ?? 0
      bv = b.sequenceNumber ?? 0
    } else if (column === 'startAt') {
      av = new Date(a.startAt).getTime()
      bv = new Date(b.startAt).getTime()
    } else if (column === 'practitionerName') {
      av = a.practitionerName ?? ''
      bv = b.practitionerName ?? ''
    } else {
      av = (a[column] ?? '') as string
      bv = (b[column] ?? '') as string
    }
    if (av < bv) return asc ? -1 : 1
    if (av > bv) return asc ? 1 : -1
    return 0
  })
  return sorted
}

function groupByWeek(bookings: Booking[]) {
  const groups = new Map<string, { year: number; week: number; bookings: Booking[] }>()
  for (const b of bookings) {
    const d = new Date(b.startAt)
    const week = getISOWeekNumber(d)
    const year = d.getFullYear()
    const key = `${year}-${week}`
    if (!groups.has(key)) groups.set(key, { year, week, bookings: [] })
    groups.get(key)!.bookings.push(b)
  }
  return Array.from(groups.values())
    .sort((a, b) => (b.year - a.year) || (b.week - a.week))
    .map((g) => ({ ...g, rangeLabel: weekRangeLabel(g.bookings) }))
}

function getISOWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function weekRangeLabel(bookings: Booking[]) {
  const dates = bookings.map((b) => new Date(b.startAt).getTime())
  const min = new Date(Math.min(...dates))
  const max = new Date(Math.max(...dates))
  const fmt = (d: Date) => d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', timeZone: 'Europe/Bucharest' })
  return `${fmt(min)} – ${fmt(max)}`
}

function NewBookingForm({
  category,
  isMultiPractitioner,
  customers,
  services,
  blockedSlots,
  practitioners,
  workingHours,
  slotIntervalMinutes,
  onDone,
}: {
  category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'
  isMultiPractitioner: boolean
  customers: { id: string; name: string }[]
  services: { id: string; name: string; durationMin: number | null }[]
  blockedSlots: { startAt: string; endAt: string }[]
  practitioners: { id: string; name: string }[]
  workingHours: WorkingRange[]
  slotIntervalMinutes: number
  onDone: () => void
}) {
  const isClinic = category === 'CLINICA'
  const appointmentBased = isAppointmentBased(category)
  const bookingSingular = appointmentBased ? 'programare' : 'rezervare'
  const bookingPlural = appointmentBased ? 'programări' : 'rezervări'
  const [customerId, setCustomerId] = useState('')
  const [newCustomerMode, setNewCustomerMode] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState('')
  const [practitionerId, setPractitionerId] = useState(practitioners.length === 1 ? practitioners[0].id : '')
  const [slotDate, setSlotDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [daySlots, setDaySlots] = useState<{ time: string; available: boolean }[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isMultiPractitioner || !serviceId || !practitionerId || !slotDate) {
      setDaySlots([])
      return
    }
    setLoadingSlots(true)
    setSelectedSlot('')
    fetchWithTimeout(
      `/api/business/practitioner-availability?serviceId=${serviceId}&practitionerId=${practitionerId}&date=${slotDate}`
    )
      .then((res) => res.json())
      .then((data) => setDaySlots(data.allSlots ?? []))
      .catch(() => setDaySlots([]))
      .finally(() => setLoadingSlots(false))
  }, [isMultiPractitioner, serviceId, practitionerId, slotDate])

  async function submit() {
    const hasCustomer = newCustomerMode ? !!newCustomerName.trim() && newCustomerPhone.trim().length >= 6 : !!customerId
    const hasDateInfo = isMultiPractitioner ? !!selectedSlot : !!date

    if (!hasCustomer || !serviceId || !hasDateInfo) {
      setError(
        newCustomerMode
          ? 'Completează numele, telefonul, serviciul și data.'
          : isMultiPractitioner
            ? `Completează ${isClinic ? 'pacient' : 'client'}, serviciu, persoană și oră.`
            : `Completează ${isClinic ? 'pacient' : 'client'}, serviciu și dată.`
      )
      return
    }
    if (isMultiPractitioner && !practitionerId) {
      setError('Alege persoana.')
      return
    }

    const service = services.find((s) => s.id === serviceId)
    const start = isMultiPractitioner ? new Date(selectedSlot) : new Date(date)
    const end = new Date(start.getTime() + (service?.durationMin ?? 30) * 60000)

    if (start < new Date()) {
      setError(`Nu poți crea o ${bookingSingular} într-un interval din trecut.`)
      return
    }

    if (!isMultiPractitioner) {
      const overlapsBlocked = blockedSlots.some((b) => start < new Date(b.endAt) && new Date(b.startAt) < end)
      if (overlapsBlocked) {
        setError(`Intervalul ales e blocat pentru ${bookingPlural} — modifică-l direct din calendar dacă e nevoie.`)
        return
      }
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetchWithTimeout('/api/business/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(newCustomerMode
            ? { customerName: newCustomerName.trim(), customerPhone: newCustomerPhone.trim() }
            : { customerId }),
          serviceId,
          practitionerId: isMultiPractitioner ? practitionerId : undefined,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'A apărut o eroare. Verifică datele.')
        return
      }

      onDone()
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-5 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-gray-500">{isClinic ? 'Pacient' : 'Client'}</label>
            <button
              type="button"
              onClick={() => setNewCustomerMode((v) => !v)}
              className="text-xs text-[var(--accent)] font-medium"
            >
              {newCustomerMode ? `← Alege ${isClinic ? 'pacient' : 'client'} existent` : `+ ${isClinic ? 'Pacient' : 'Client'} nou`}
            </button>
          </div>
          {newCustomerMode ? (
            <div className="flex flex-col gap-2">
              <Input placeholder={isClinic ? 'Nume pacient' : 'Nume client'} value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
              <Input
                placeholder="Telefon"
                type="tel"
                inputMode="tel"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
              />
            </div>
          ) : (
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-field w-full">
              <option value="">{isClinic ? 'Alege pacient' : 'Alege client'}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1.5">Serviciu</label>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input-field w-full">
            <option value="">Alege serviciu</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isMultiPractitioner ? (
        <div className="mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {practitioners.length > 1 && (
              <div>
                <label className="text-sm text-gray-500 block mb-1.5">Persoana</label>
                <select value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} className="input-field w-full">
                  <option value="">Alege persoana</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {practitioners.length === 0 && (
              <p className="text-sm text-amber-600 sm:col-span-2">
                Nicio persoană activă — adaugă una din{' '}
                <a href="/dashboard/medici" className="underline">
                  {isClinic ? 'Medici' : 'Echipă'}
                </a>{' '}
                ca să poți programa.
              </p>
            )}
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Data</label>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                min={(() => {
                  const d = new Date()
                  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                })()}
                className="input-field w-full"
              />
            </div>
          </div>

          {practitionerId && serviceId && (
            <div>
              <label className="text-sm text-gray-500 block mb-2">
                Oră disponibilă {services.find((s) => s.id === serviceId)?.durationMin ? `(pas de ${services.find((s) => s.id === serviceId)?.durationMin} min, după durata serviciului)` : ''}
              </label>
              {loadingSlots ? (
                <p className="text-sm text-gray-400">Se încarcă orele...</p>
              ) : daySlots.length === 0 ? (
                <p className="text-sm text-gray-500">Niciun program setat pentru această persoană în ziua aleasă.</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {daySlots.map((slot) => {
                    const time = new Date(slot.time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' })
                    if (!slot.available) {
                      return (
                        <span key={slot.time} className="py-2 rounded-lg text-center text-sm text-gray-300 border border-[var(--border-soft)] line-through select-none">
                          {time}
                        </span>
                      )
                    }
                    const active = selectedSlot === slot.time
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => setSelectedSlot(slot.time)}
                        className="py-2 rounded-lg text-center text-sm font-medium border transition"
                        style={active ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : {}}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-3 max-w-xs">
          <div>
            <label className="text-sm text-gray-500 block mb-1.5">Data și ora</label>
            <WorkingDateTimePicker
              value={date}
              onChange={setDate}
              workingHours={workingHours}
              durationMinutes={services.find((service) => service.id === serviceId)?.durationMin ?? 30}
              stepMinutes={slotIntervalMinutes}
              minDate={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)}
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <Button variant="secondary" onClick={submit} disabled={saving}>
        {saving ? 'Se salvează...' : `Salvează ${bookingSingular}a`}
      </Button>
    </Card>
  )
}
