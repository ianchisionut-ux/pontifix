import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import CalendarClient from './calendar-client'
import { calculateAdaptiveSlotStep } from '@/lib/availability'

function computeMinMax(hours: { startTime: string; endTime: string }[], fallbackMin = '08:00', fallbackMax = '20:00') {
  if (hours.length === 0) return { minTime: fallbackMin, maxTime: fallbackMax }
  return {
    minTime: hours.reduce((min, wh) => (wh.startTime < min ? wh.startTime : min), hours[0].startTime),
    maxTime: hours.reduce((max, wh) => (wh.endTime > max ? wh.endTime : max), hours[0].endTime),
  }
}

export default async function CalendarPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      workingHours: true,
      services: { where: { active: true, type: 'APPOINTMENT' }, select: { durationMin: true } },
    },
  })

  const isMultiPractitioner = (business?.teamSize ?? 1) > 1

  const [bookings, blockedSlots, practitioners] = await Promise.all([
    prisma.booking.findMany({
      where: { businessId, status: { not: 'CANCELLED' } },
      include: { customer: true, service: true, practitioner: true },
      orderBy: { startAt: 'asc' },
    }),
    prisma.blockedSlot.findMany({ where: { businessId } }),
    isMultiPractitioner
      ? prisma.practitioner.findMany({ where: { businessId, active: true }, include: { workingHours: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ])

  const events = bookings.map((b) => ({
    id: b.id,
    title: `${b.customer.name ?? b.customer.phone} — ${b.service.name}${b.practitioner ? ` (${b.practitioner.name})` : ''}`,
    start: b.startAt,
    end: b.endAt,
    status: b.status,
    customerId: b.customerId,
    customerName: b.customer.name ?? b.customer.phone ?? 'Fără nume',
    customerPhone: b.customer.phone ?? '',
    serviceName: b.service.name,
    practitionerId: b.practitionerId,
    practitionerName: b.practitioner?.name ?? null,
    confirmationRequestSent: b.confirmationRequestSent,
    customerConfirmed: b.customerConfirmed,
  }))

  const { minTime, maxTime } = computeMinMax(business?.workingHours ?? [])

  return (
    <CalendarClient
      category={business?.category ?? 'SALON'}
      events={events}
      blockedSlots={blockedSlots.map((b) => ({
        id: b.id,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        reason: b.reason,
      }))}
      minTime={minTime}
      maxTime={maxTime}
      businessWorkingHours={(business?.workingHours ?? []).map((h) => ({ weekday: h.weekday, startTime: h.startTime, endTime: h.endTime }))}
      businessBreaks={[
        ...(business?.break1Start && business.break1End ? [{ label: 'Pauză', startTime: business.break1Start, endTime: business.break1End }] : []),
        ...(business?.break2Start && business.break2End ? [{ label: 'Pauză 2', startTime: business.break2Start, endTime: business.break2End }] : []),
        ...(business?.break3Start && business.break3End ? [{ label: 'Pauză 3', startTime: business.break3Start, endTime: business.break3End }] : []),
      ]}
      slotIntervalMinutes={
        business?.category === 'EVENT_VENUE'
          ? 60
          : calculateAdaptiveSlotStep(
              business?.services.map((service) => service.durationMin) ?? [],
              business?.slotIntervalMinutes
            )
      }
      practitioners={practitioners.map((p) => {
        const range = computeMinMax(p.workingHours, minTime, maxTime)
        return {
          id: p.id, name: p.name, minTime: range.minTime, maxTime: range.maxTime,
          workingHours: p.workingHours.map((h) => ({ weekday: h.weekday, startTime: h.startTime, endTime: h.endTime })),
          breaks: [
            ...(p.break1Start && p.break1End ? [{ label: 'Pauză', startTime: p.break1Start, endTime: p.break1End }] : []),
            ...(p.break2Start && p.break2End ? [{ label: 'Pauză 2', startTime: p.break2Start, endTime: p.break2End }] : []),
            ...(p.break3Start && p.break3End ? [{ label: 'Pauză 3', startTime: p.break3Start, endTime: p.break3End }] : []),
          ],
        }
      })}
    />
  )
}
