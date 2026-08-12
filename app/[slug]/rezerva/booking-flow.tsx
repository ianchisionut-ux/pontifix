'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

type Service = {
  id: string
  resourceId?: string | null
  name: string
  durationMin: number | null
  price: number | null
  requiresDeposit: boolean
  depositAmount: number | null
}

type DaySlot = { time: string; available: boolean }
type Practitioner = { id: string; name: string; specialization: string | null }

const STORAGE_KEY = 'bookeasy_customer_info'

function buildNextDays(count: number) {
  const days: Date[] = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

function toDateParam(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function BookingFlow({
  businessId,
  businessSlug,
  category,
  isMultiPractitioner,
  services,
  canPayOnline,
  accentColor,
  accentSoftColor,
}: {
  businessId: string
  businessSlug: string
  category: 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'
  isMultiPractitioner: boolean
  services: Service[]
  canPayOnline: boolean
  accentColor: string
  accentSoftColor: string
}) {
  const isAppointment = category === 'SALON' || category === 'CLINICA'
  const isVenue = category === 'EVENT_VENUE'
  const days = useMemo(() => buildNextDays(30), [])

  const [service, setService] = useState<Service | null>(services[0] ?? null)
  const [practitioners, setPractitioners] = useState<Practitioner[]>([])
  const [practitionersLoaded, setPractitionersLoaded] = useState(false)
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(days[0])
  const [daySlots, setDaySlots] = useState<DaySlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [venueDurationHours, setVenueDurationHours] = useState(1)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE'>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const daysScrollRef = useRef<HTMLDivElement>(null)

  function scrollDays(direction: 'left' | 'right') {
    daysScrollRef.current?.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' })
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { name: savedName, phone: savedPhone } = JSON.parse(saved)
        setName(savedName ?? '')
        setPhone(savedPhone ?? '')
      }
    } catch {
      // localStorage indisponibil (mod privat etc.) — pornim de la câmpuri goale
    }
  }, [])

  // când businessul are mai multe persoane, la schimbarea serviciului reîncărcăm lista
  // de persoane eligibile pentru acel serviciu
  useEffect(() => {
    if (!isMultiPractitioner || !service) return
    setPractitionerId(null)
    setPractitionersLoaded(false)
    fetchWithTimeout(`/api/public/practitioners?businessId=${businessId}&serviceId=${service.id}`)
      .then((res) => res.json())
      .then((data) => {
        const list: Practitioner[] = data.practitioners ?? []
        setPractitioners(list)
        if (list.length > 0) setPractitionerId(list[0].id)
      })
      .catch(() => setPractitioners([]))
      .finally(() => setPractitionersLoaded(true))
  }, [service, isMultiPractitioner, businessId])

  useEffect(() => {
    if ((!isAppointment && !isVenue) || !service) return
    // așteptăm explicit ca lista de persoane să se termine de încărcat, altfel cererea
    // de ore ar cădea greșit pe programul general, nu pe cel al persoanei alese
    if (isAppointment && isMultiPractitioner && (!practitionersLoaded || (practitioners.length > 0 && !practitionerId))) return
    setLoadingSlots(true)
    setSelectedSlot(null)
    setError('')

    const practitionerParam = isAppointment && isMultiPractitioner && practitionerId ? `&practitionerId=${practitionerId}` : ''
    const venueParam = isVenue && service.resourceId ? `&resourceId=${service.resourceId}&durationMinutes=${venueDurationHours * 60}` : ''
    fetchWithTimeout(`/api/public/availability?businessId=${businessId}&serviceId=${service.id}&date=${toDateParam(selectedDate)}${practitionerParam}${venueParam}`)
      .then((res) => res.json())
      .then((data) => setDaySlots(data.allSlots ?? []))
      .catch(() => setDaySlots([]))
      .finally(() => setLoadingSlots(false))
  }, [service, selectedDate, businessId, isAppointment, isVenue, isMultiPractitioner, practitionerId, practitionersLoaded, venueDurationHours])

  function selectService(s: Service) {
    setService(s)
  }

  async function submitBooking() {
    if (!service) {
      setError('Alege un serviciu.')
      return
    }
    if ((isAppointment || isVenue) && !selectedSlot) {
      setError('Alege o oră disponibilă.')
      return
    }
    if (!name.trim() || phone.trim().length < 6) {
      setError('Completează numele și un număr de telefon valid.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }))
    } catch {
      // ignorăm dacă localStorage nu e disponibil
    }

    const startAt = isAppointment || isVenue ? selectedSlot! : new Date(`${toDateParam(selectedDate)}T00:00:00`).toISOString()

    try {
      const res = await fetchWithTimeout('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          serviceId: service.id,
          practitionerId: isMultiPractitioner ? practitionerId : undefined,
          resourceId: isVenue ? service.resourceId : undefined,
          durationMinutes: isVenue ? venueDurationHours * 60 : undefined,
          startAt,
          customerName: name,
          customerPhone: phone,
          paymentMethod,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare. Te rugăm încearcă din nou.')
        return
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return
      }

      setDone(true)
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Card>
        <h2 className="text-lg font-semibold mb-1">{category === 'CLINICA' ? 'Programare confirmată! 🎉' : 'Rezervare confirmată! 🎉'}</h2>
        <p className="text-sm text-gray-600">Te așteptăm — vei primi confirmarea și pe telefonul indicat.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Alege serviciul */}
      <div>
        <h2 className="font-semibold mb-3">{isAppointment ? 'Alege serviciul' : 'Alege sala/pachetul'}</h2>
        <div className="flex flex-col gap-2">
          {services.map((s) => {
            const active = service?.id === s.id
            return (
              <button
                key={s.id}
                onClick={() => selectService(s)}
                className="text-left p-3.5 rounded-2xl border transition"
                style={{
                  borderColor: active ? accentColor : 'var(--border-soft)',
                  background: active ? accentSoftColor : 'white',
                }}
              >
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isAppointment && s.durationMin ? `${s.durationMin} min · ` : ''}
                  {s.price ? `${s.price} lei` : ''}
                </p>
              </button>
            )
          })}
          {services.length === 0 && <p className="text-sm text-gray-500">Momentan niciun serviciu disponibil.</p>}
        </div>
      </div>

      {/* Alege medicul/persoana — doar dacă businessul are mai multe persoane */}
      {isMultiPractitioner && practitioners.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Alege persoana</h2>
          <div className="flex flex-wrap gap-2">
            {practitioners.map((p) => {
              const active = practitionerId === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setPractitionerId(p.id)}
                  className="text-left px-3.5 py-2 rounded-2xl border transition"
                  style={{
                    borderColor: active ? accentColor : 'var(--border-soft)',
                    background: active ? accentSoftColor : 'white',
                  }}
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.specialization && <p className="text-xs text-gray-500">{p.specialization}</p>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Alege data — carusel orizontal de zile */}
      <div>
        <h2 className="font-semibold mb-3">Alege data</h2>
        <div className="relative flex items-center gap-1">
          <button
            onClick={() => scrollDays('left')}
            aria-label="Zile anterioare"
            className="hidden sm:flex shrink-0 w-8 h-8 rounded-full border border-[var(--border-soft)] items-center justify-center bg-white hover:bg-gray-50"
          >
            ‹
          </button>
          <div ref={daysScrollRef} className="flex gap-2 overflow-x-auto no-scrollbar pb-1 scroll-smooth">
            {days.map((d) => {
              const active = toDateParam(d) === toDateParam(selectedDate)
              const dayName = d.toLocaleDateString('ro-RO', { weekday: 'short', timeZone: 'Europe/Bucharest' })
              const dayNum = d.getDate()
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDate(d)}
                  className="shrink-0 w-16 py-2.5 rounded-2xl border text-center transition"
                  style={{
                    borderColor: active ? accentColor : 'var(--border-soft)',
                    background: active ? accentColor : 'white',
                    color: active ? 'white' : 'var(--foreground)',
                  }}
                >
                  <p className="text-xs uppercase" style={{ opacity: active ? 0.85 : 0.6 }}>
                    {dayName.replace('.', '')}
                  </p>
                  <p className="text-lg font-semibold leading-tight">{dayNum}</p>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => scrollDays('right')}
            aria-label="Zile următoare"
            className="hidden sm:flex shrink-0 w-8 h-8 rounded-full border border-[var(--border-soft)] items-center justify-center bg-white hover:bg-gray-50"
          >
            ›
          </button>
        </div>
      </div>

      {isVenue && (
        <div>
          <h2 className="font-semibold mb-3">Durata închirierii</h2>
          <select
            value={venueDurationHours}
            onChange={(event) => setVenueDurationHours(Number(event.target.value))}
            className="input-field w-full"
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((hours) => (
              <option key={hours} value={hours}>{hours} {hours === 1 ? 'oră' : 'ore'}</option>
            ))}
          </select>
        </div>
      )}

      {/* Alege ora */}
      {(isAppointment || isVenue) && (
        <div>
          <h2 className="font-semibold mb-3">Alege ora</h2>
          {loadingSlots ? (
            <p className="text-sm text-gray-500">Se încarcă orele...</p>
          ) : daySlots.length === 0 ? (
            <p className="text-sm text-gray-500">Nicio oră de lucru în această zi. Alege altă dată.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {daySlots.map((slot) => {
                const time = new Date(slot.time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' })
                const active = selectedSlot === slot.time
                if (!slot.available) {
                  return (
                    <span
                      key={slot.time}
                      className="py-2.5 rounded-xl text-center text-sm text-gray-300 border border-[var(--border-soft)] line-through select-none"
                    >
                      {time}
                    </span>
                  )
                }
                return (
                  <button
                    key={slot.time}
                    onClick={() => setSelectedSlot(slot.time)}
                    className="py-2.5 rounded-xl text-center text-sm font-medium border transition"
                    style={{
                      borderColor: active ? accentColor : 'var(--border-soft)',
                      background: active ? accentColor : 'white',
                      color: active ? 'white' : 'var(--foreground)',
                    }}
                  >
                    {time}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Detaliile tale */}
      <div>
        <h2 className="font-semibold mb-3">Detaliile tale</h2>
        <div className="flex flex-col gap-2">
          <Input placeholder="Numele tău" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Telefon" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      {/* Plată, dacă e cazul */}
      {canPayOnline && service?.requiresDeposit && (
        <div>
          <h2 className="font-semibold mb-3">Plată</h2>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setPaymentMethod('CASH')}
              className="p-3.5 rounded-2xl border text-left flex items-center justify-between"
              style={{ borderColor: paymentMethod === 'CASH' ? accentColor : 'var(--border-soft)' }}
            >
              <span className="font-medium">Numerar la locație</span>
            </button>
            <button
              onClick={() => setPaymentMethod('ONLINE')}
              className="p-3.5 rounded-2xl border text-left flex items-center justify-between"
              style={{ borderColor: paymentMethod === 'ONLINE' ? accentColor : 'var(--border-soft)' }}
            >
              <span className="font-medium">Card online</span>
              <span className="text-sm text-gray-500">Avans {service.depositAmount} lei</span>
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        onClick={submitBooking}
        disabled={submitting}
        className="w-full py-3.5 text-base"
        style={{ background: accentColor, borderColor: accentColor }}
      >
        {submitting ? 'Se trimite...' : category === 'CLINICA' ? 'Confirmă programarea' : 'Confirmă rezervarea'}
      </Button>
    </div>
  )
}
