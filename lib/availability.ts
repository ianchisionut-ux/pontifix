import { prisma } from './prisma'
import { addMinutes } from 'date-fns'

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x
}

// Grila automată folosește cel mai mare divizor comun al duratelor active.
// 30/60/90 => 30, doar 60 => 60, 45/60 => 15. O setare manuală poate
// face grila mai rară, dar nu o poate fragmenta sub pasul util calculat.
export function calculateAdaptiveSlotStep(durations: (number | null)[], configuredStep?: number | null): number {
  const valid = durations.filter(
    (value): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0
  )
  const automatic = valid.length > 0 ? valid.reduce((current, value) => gcd(current, value)) : 30
  const safeAutomatic = Math.max(5, Math.min(automatic, 180))
  return configuredStep ? Math.max(configuredStep, safeAutomatic) : safeAutomatic
}

// bookeasy.ro funcționează cu o singură gestiune per salon (fără angajați multipli) —
// un slot ocupat blochează acea oră pentru toți clienții, nu doar pentru "cineva anume"
export async function getAvailableSlots(businessId: string, serviceId: string, date: Date) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) return []

  if (service.type === 'APPOINTMENT') {
    return getSingleSlotAvailability(businessId, service, date)
  }
  return getResourceAvailability(businessId, service, date)
}

// intervalele blocate ale unei zile — folosite atât pentru filtrarea sloturilor
// oferite de bot, cât și pentru verificarea "ultima clipă" la confirmare
async function getBlockedSlotsForDay(businessId: string, date: Date) {
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  return prisma.blockedSlot.findMany({
    where: { businessId, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
  })
}

async function isRangeBlocked(businessId: string, start: Date, end: Date): Promise<boolean> {
  const blocked = await prisma.blockedSlot.findFirst({
    where: { businessId, startAt: { lt: end }, endAt: { gt: start } },
  })
  return !!blocked
}

// apelată la confirmarea finală a unei rezervări — verifică dacă intervalul exact
// mai e liber chiar în acel moment (nu mai alocă niciun "angajat", doar validează sloul)
export async function isSlotStillAvailable(businessId: string, serviceId: string, startAt: Date): Promise<boolean> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) return false

  if (await isWithinLeadTime(businessId, startAt)) return false

  const duration = service.durationMin ?? 30
  const endAt = addMinutes(startAt, duration)

  if (await isRangeBlocked(businessId, startAt, endAt)) return false

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { break1Start: true, break1End: true, break2Start: true, break2End: true, break3Start: true, break3End: true },
  })
  const onBreak = getBusinessBreaks(business, startAt).some((b) => overlaps(startAt, endAt, b.startAt, b.endAt))
  if (onBreak) return false

  const conflict = await prisma.booking.findFirst({
    where: { businessId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
  })
  return !conflict
}

// folosită de rutele API pentru rezervări manuale/mutări — verifică dacă un interval
// se suprapune cu vreun BlockedSlot al business-ului
export async function isIntervalBlocked(businessId: string, start: Date, end: Date): Promise<boolean> {
  return isRangeBlocked(businessId, start, end)
}

// Ultima barieră comună pentru operațiile făcute din dashboard. Interfața avertizează
// imediat, dar serverul trebuie să respingă suprapunerile chiar și când două cereri
// ajung aproape simultan sau când ruta este apelată direct.
export async function hasActiveBookingConflict(
  businessId: string,
  practitionerId: string | null | undefined,
  start: Date,
  end: Date,
  ignoreBookingId?: string
): Promise<boolean> {
  const conflict = await prisma.booking.findFirst({
    where: {
      businessId,
      ...(practitionerId ? { practitionerId } : {}),
      ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
      status: { in: ['CONFIRMED', 'PENDING'] },
      startAt: { lt: end },
      endAt: { gt: start },
    },
    select: { id: true },
  })
  return !!conflict
}

// Validare comună pentru programările manuale și mutările din dashboard.
// Intervalul trebuie să încapă integral în programul zilei profilului selectat.
export async function isWithinWorkingHours(
  businessId: string,
  practitionerId: string | null | undefined,
  start: Date,
  end: Date
): Promise<boolean> {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(start)
  const part = (type: string) => dateParts.find((item) => item.type === type)?.value ?? ''
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekday = weekdayMap[part('weekday')]
  const localDate = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`)

  const [ranges, profile] = practitionerId
    ? await Promise.all([
        prisma.practitionerWorkingHours.findMany({ where: { practitionerId, weekday } }),
        prisma.practitioner.findUnique({ where: { id: practitionerId }, select: { break1Start: true, break1End: true, break2Start: true, break2End: true, break3Start: true, break3End: true } }),
      ])
    : await Promise.all([
        prisma.workingHours.findMany({ where: { businessId, weekday } }),
        prisma.business.findUnique({ where: { id: businessId }, select: { break1Start: true, break1End: true, break2Start: true, break2End: true, break3Start: true, break3End: true } }),
      ])

  const nonStop = !practitionerId && ranges.some((range) => range.startTime === '00:00' && range.endTime === '23:59')
  const breakDates = nonStop
    ? Array.from({ length: 8 }, (_, index) => {
        const day = new Date(localDate)
        day.setUTCDate(day.getUTCDate() + index)
        return day
      })
    : [localDate]
  const breaks = breakDates.flatMap((day) => getBusinessBreaks(profile, day))
  if (breaks.some((item) => overlaps(start, end, item.startAt, item.endAt))) return false

  if (nonStop) return true

  return ranges.some((range) => {
    const rangeStart = combineDateAndTime(localDate, range.startTime)
    const rangeEnd = combineDateAndTime(localDate, range.endTime)
    return start >= rangeStart && end <= rangeEnd
  })
}

// verifică dacă un moment e prea aproape de acum, față de limita minimă a business-ului —
// folosită la crearea și la anularea rezervărilor venite din exterior (bot, site public).
// Rezervările făcute manual de admin din dashboard NU folosesc această funcție — el știe
// cum gestionează programul și poate adăuga chiar și cu 30 min înainte.
export async function isWithinLeadTime(businessId: string, momentToCheck: Date): Promise<boolean> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { minLeadTimeMinutes: true } })
  const minLeadMs = (business?.minLeadTimeMinutes ?? 120) * 60 * 1000
  return momentToCheck.getTime() - Date.now() < minLeadMs
}

// pentru clinici — sloturi calculate pe programul unui medic ANUME, cu verificare de
// suprapunere doar față de programările ACELUIAȘI medic (nu blochează tot cabinetul,
// alți medici pot avea pacienți în paralel)
export async function getPractitionerDaySlotsWithStatus(
  businessId: string,
  serviceId: string,
  practitionerId: string,
  date: Date,
  ignoreLeadTime = false,
  stepOverride?: number
): Promise<{ time: string; available: boolean }[]> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service || service.type !== 'APPOINTMENT') return []

  const weekday = date.getUTCDay() // neambiguu, indiferent de fusul serverului
  const [business, practitioner, workingHours, existingBookings, blockedSlots, profileServices] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { slotIntervalMinutes: true, minLeadTimeMinutes: true } }),
    prisma.practitioner.findUnique({ where: { id: practitionerId }, select: { break1Start: true, break1End: true, break2Start: true, break2End: true, break3Start: true, break3End: true } }),
    prisma.practitionerWorkingHours.findMany({ where: { practitionerId, weekday } }),
    prisma.booking.findMany({ where: { practitionerId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { gte: date } } }),
    getBlockedSlotsForDay(businessId, date),
    prisma.service.findMany({
      where: {
        businessId,
        active: true,
        type: 'APPOINTMENT',
        OR: [{ practitioners: { none: {} } }, { practitioners: { some: { practitionerId } } }],
      },
      select: { durationMin: true },
    }),
  ])

  // pauzele medicului (masă etc.) — aceleași ore, în fiecare zi lucrătoare
  const breaks: { startAt: Date; endAt: Date }[] = []
  if (practitioner?.break1Start && practitioner.break1End) {
    breaks.push({ startAt: combineDateAndTime(date, practitioner.break1Start), endAt: combineDateAndTime(date, practitioner.break1End) })
  }
  if (practitioner?.break2Start && practitioner.break2End) {
    breaks.push({ startAt: combineDateAndTime(date, practitioner.break2Start), endAt: combineDateAndTime(date, practitioner.break2End) })
  }
  if (practitioner?.break3Start && practitioner.break3End) {
    breaks.push({ startAt: combineDateAndTime(date, practitioner.break3Start), endAt: combineDateAndTime(date, practitioner.break3End) })
  }

  const duration = service.durationMin ?? 30
  const step = stepOverride ?? calculateAdaptiveSlotStep(
    profileServices.length > 0 ? profileServices.map((item) => item.durationMin) : [duration],
    business?.slotIntervalMinutes
  )
  const minLeadMs = ignoreLeadTime ? 0 : (business?.minLeadTimeMinutes ?? 120) * 60 * 1000
  const earliestAllowed = new Date(Date.now() + minLeadMs)
  const result: { time: string; available: boolean }[] = []

  for (const wh of workingHours) {
    let cursor = combineDateAndTime(date, wh.startTime)
    const end = combineDateAndTime(date, wh.endTime)

    while (addMinutes(cursor, duration) <= end) {
      const slotEnd = addMinutes(cursor, duration)

      const tooSoon = cursor < earliestAllowed
      const blockedHere = blockedSlots.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))
      const bookedHere = existingBookings.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))
      const onBreak = breaks.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))

      result.push({ time: cursor.toISOString(), available: !tooSoon && !blockedHere && !bookedHere && !onBreak })
      cursor = addMinutes(cursor, step)
    }
  }

  return result
}

// verificare finală, la confirmare — echivalentul isSlotStillAvailable, dar per medic
export async function isPractitionerSlotStillAvailable(
  businessId: string,
  serviceId: string,
  practitionerId: string,
  startAt: Date
): Promise<boolean> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) return false
  if (await isWithinLeadTime(businessId, startAt)) return false

  const duration = service.durationMin ?? 30
  const endAt = addMinutes(startAt, duration)

  const [conflict, blocked, practitioner] = await Promise.all([
    prisma.booking.findFirst({
      where: { practitionerId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
    }),
    isIntervalBlocked(businessId, startAt, endAt),
    prisma.practitioner.findUnique({ where: { id: practitionerId }, select: { break1Start: true, break1End: true, break2Start: true, break2End: true, break3Start: true, break3End: true } }),
  ])

  const breaks: { startAt: Date; endAt: Date }[] = []
  if (practitioner?.break1Start && practitioner.break1End) {
    breaks.push({ startAt: combineDateAndTime(startAt, practitioner.break1Start), endAt: combineDateAndTime(startAt, practitioner.break1End) })
  }
  if (practitioner?.break2Start && practitioner.break2End) {
    breaks.push({ startAt: combineDateAndTime(startAt, practitioner.break2Start), endAt: combineDateAndTime(startAt, practitioner.break2End) })
  }
  if (practitioner?.break3Start && practitioner.break3End) {
    breaks.push({ startAt: combineDateAndTime(startAt, practitioner.break3Start), endAt: combineDateAndTime(startAt, practitioner.break3End) })
  }
  const onBreak = breaks.some((b) => overlaps(startAt, endAt, b.startAt, b.endAt))

  return !conflict && !blocked && !onBreak
}

export async function getDaySlotsWithStatus(
  businessId: string,
  serviceId: string,
  date: Date
): Promise<{ time: string; available: boolean }[]> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service || service.type !== 'APPOINTMENT') return []

  const weekday = date.getUTCDay() // neambiguu, indiferent de fusul serverului
  const [business, workingHours, existingBookings, blockedSlots, activeServices] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { slotIntervalMinutes: true, minLeadTimeMinutes: true, break1Start: true, break1End: true, break2Start: true, break2End: true, break3Start: true, break3End: true },
    }),
    prisma.workingHours.findMany({ where: { businessId, weekday } }),
    prisma.booking.findMany({ where: { businessId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { gte: date } } }),
    getBlockedSlotsForDay(businessId, date),
    prisma.service.findMany({ where: { businessId, active: true, type: 'APPOINTMENT' }, select: { durationMin: true } }),
  ])

  const breaks = getBusinessBreaks(business, date)

  const duration = service.durationMin ?? 30
  const step = calculateAdaptiveSlotStep(activeServices.map((item) => item.durationMin), business?.slotIntervalMinutes)
  const minLeadMs = (business?.minLeadTimeMinutes ?? 120) * 60 * 1000
  const earliestAllowed = new Date(Date.now() + minLeadMs)
  const result: { time: string; available: boolean }[] = []

  for (const wh of workingHours) {
    let cursor = combineDateAndTime(date, wh.startTime)
    const end = combineDateAndTime(date, wh.endTime)

    while (addMinutes(cursor, duration) <= end) {
      const slotEnd = addMinutes(cursor, duration)

      const tooSoon = cursor < earliestAllowed
      const blockedHere = blockedSlots.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))
      const bookedHere = existingBookings.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))
      const onBreak = breaks.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))

      result.push({ time: cursor.toISOString(), available: !tooSoon && !blockedHere && !bookedHere && !onBreak })
      cursor = addMinutes(cursor, step)
    }
  }

  return result
}

export async function getVenueDaySlotsWithStatus(
  businessId: string,
  resourceId: string,
  date: Date,
  durationMinutes: number
): Promise<{ time: string; available: boolean }[]> {
  if (durationMinutes < 60 || durationMinutes > 720 || durationMinutes % 60 !== 0) return []

  const weekday = date.getUTCDay()
  const windowStart = combineDateAndTime(date, '00:00')
  const searchEnd = addMinutes(windowStart, 36 * 60)
  const [business, resource, workingHours, existingBookings, blockedSlots] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { minLeadTimeMinutes: true, break1Start: true, break1End: true, break2Start: true, break2End: true, break3Start: true, break3End: true },
    }),
    prisma.resource.findFirst({ where: { id: resourceId, businessId }, select: { id: true } }),
    prisma.workingHours.findMany({ where: { businessId, weekday } }),
    prisma.booking.findMany({
      where: { resourceId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { lt: searchEnd }, endAt: { gt: windowStart } },
    }),
    prisma.blockedSlot.findMany({ where: { businessId, startAt: { lt: searchEnd }, endAt: { gt: windowStart } } }),
  ])
  if (!business || !resource) return []

  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  const breaks = [...getBusinessBreaks(business, date), ...getBusinessBreaks(business, nextDate)]
  const earliestAllowed = new Date(Date.now() + (business.minLeadTimeMinutes ?? 120) * 60000)
  const result: { time: string; available: boolean }[] = []

  for (const range of workingHours) {
    let cursor = combineDateAndTime(date, range.startTime)
    const rangeEnd = combineDateAndTime(date, range.endTime)
    const nonStop = range.startTime === '00:00' && range.endTime === '23:59'
    const lastStart = nonStop ? combineDateAndTime(nextDate, '00:00') : rangeEnd
    while (cursor < lastStart && (nonStop || addMinutes(cursor, durationMinutes) <= rangeEnd)) {
      const slotEnd = addMinutes(cursor, durationMinutes)
      const unavailable =
        cursor < earliestAllowed ||
        blockedSlots.some((item) => overlaps(cursor, slotEnd, item.startAt, item.endAt)) ||
        existingBookings.some((item) => overlaps(cursor, slotEnd, item.startAt, item.endAt)) ||
        breaks.some((item) => overlaps(cursor, slotEnd, item.startAt, item.endAt))
      result.push({ time: cursor.toISOString(), available: !unavailable })
      cursor = addMinutes(cursor, 60)
    }
  }
  return result
}

async function getSingleSlotAvailability(businessId: string, service: { id: string; durationMin: number | null }, date: Date) {
  const weekday = date.getUTCDay() // neambiguu, indiferent de fusul serverului
  const [business, workingHours, existingBookings, blockedSlots, activeServices] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { slotIntervalMinutes: true, minLeadTimeMinutes: true, break1Start: true, break1End: true, break2Start: true, break2End: true, break3Start: true, break3End: true },
    }),
    prisma.workingHours.findMany({ where: { businessId, weekday } }),
    prisma.booking.findMany({ where: { businessId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { gte: date } } }),
    getBlockedSlotsForDay(businessId, date),
    prisma.service.findMany({ where: { businessId, active: true, type: 'APPOINTMENT' }, select: { durationMin: true } }),
  ])

  const breaks = getBusinessBreaks(business, date)

  const duration = service.durationMin ?? 30
  // Pasul este calculat din toate serviciile active, astfel încât un serviciu scurt
  // să poată umple natural spațiul rămas lângă unul mai lung.
  const step = calculateAdaptiveSlotStep(activeServices.map((item) => item.durationMin), business?.slotIntervalMinutes)
  // sloturile prea apropiate de acum nu sunt oferite deloc clienților din exterior —
  // funcția asta e folosită DOAR de bot și de pagina publică de rezervare, niciodată
  // de dashboard-ul admin, deci e sigur să aplicăm limita mereu, aici
  const minLeadMs = (business?.minLeadTimeMinutes ?? 120) * 60 * 1000
  const earliestAllowed = new Date(Date.now() + minLeadMs)
  const slots: string[] = []

  for (const wh of workingHours) {
    let cursor = combineDateAndTime(date, wh.startTime)
    const end = combineDateAndTime(date, wh.endTime)

    while (addMinutes(cursor, duration) <= end) {
      const slotEnd = addMinutes(cursor, duration)

      const tooSoon = cursor < earliestAllowed
      const blockedHere = blockedSlots.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))
      const bookedHere = existingBookings.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))
      const onBreak = breaks.some((b) => overlaps(cursor, slotEnd, b.startAt, b.endAt))

      if (!tooSoon && !blockedHere && !bookedHere && !onBreak) slots.push(cursor.toISOString())
      cursor = addMinutes(cursor, step)
    }
  }

  return slots
}

async function getResourceAvailability(businessId: string, service: { id: string }, date: Date) {
  const resources = await prisma.resource.findMany({ where: { businessId } })
  const existingBookings = await prisma.booking.findMany({
    where: { businessId, status: { in: ['CONFIRMED', 'PENDING'] } },
  })
  const blockedSlots = await getBlockedSlotsForDay(businessId, date)

  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const wholeDayBlocked = blockedSlots.some((b) => b.startAt <= dayStart && b.endAt >= dayEnd)
  if (wholeDayBlocked) return []

  return resources
    .filter((r) => !existingBookings.some((b) => b.resourceId === r.id && sameDay(b.startAt, date)))
    .map((r) => r.id)
}

// offset-ul real al Bucureștiului față de UTC, pentru o dată dată — ține cont automat
// de ora de vară/iarnă (EEST/EET), calculat din baza de date de fusuri orare ICU,
// INDIFERENT de fusul orar cu care rulează efectiv procesul Node.js pe server
function bucharestOffsetString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest',
    timeZoneName: 'longOffset',
  }).formatToParts(date)
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+02:00'
  return raw.replace('GMT', '') // ex: "+03:00" sau "+02:00"
}

function getBusinessBreaks(
  business: {
    break1Start: string | null
    break1End: string | null
    break2Start: string | null
    break2End: string | null
    break3Start: string | null
    break3End: string | null
  } | null,
  date: Date
): { startAt: Date; endAt: Date }[] {
  const breaks: { startAt: Date; endAt: Date }[] = []
  if (business?.break1Start && business.break1End) {
    breaks.push({ startAt: combineDateAndTime(date, business.break1Start), endAt: combineDateAndTime(date, business.break1End) })
  }
  if (business?.break2Start && business.break2End) {
    breaks.push({ startAt: combineDateAndTime(date, business.break2Start), endAt: combineDateAndTime(date, business.break2End) })
  }
  if (business?.break3Start && business.break3End) {
    breaks.push({ startAt: combineDateAndTime(date, business.break3Start), endAt: combineDateAndTime(date, business.break3End) })
  }
  return breaks
}

function combineDateAndTime(date: Date, time: string): Date {
  // extragem anul/luna/ziua din obiectul `date` folosind componentele UTC — `date` e
  // construit mereu ca miezul nopții pentru ziua respectivă, deci UTC și local coincid
  // ca zi calendaristică indiferent de fusul serverului
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const offset = bucharestOffsetString(date)
  // construim direct momentul UTC corect pentru "HH:MM ora României", fără să trecem
  // deloc prin interpretarea locală a serverului (care s-a dovedit a fi UTC, nu București)
  return new Date(`${y}-${m}-${d}T${time}:00${offset}`)
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}
