import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProgramariManager from './programari-manager'
import { calculateAdaptiveSlotStep } from '@/lib/availability'

export default async function ProgramariPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const { status, q } = await searchParams

  // prindem ID-urile ÎNAINTE să le marcăm "văzute" — altfel highlight-ul n-ar apărea
  // niciodată, nici la prima afișare. La următoarea vizită a paginii, nemaifiind
  // "nevăzute", highlight-ul dispare automat — exact comportamentul dorit.
  // business.findUnique nu depinde de nimic aici, deci rulează în paralel — dar
  // updateMany trebuie să rămână STRICT după citire, altfel stricăm exact logica de mai sus
  const [newlyConfirmed, business] = await Promise.all([
    prisma.booking.findMany({
      where: { businessId, confirmationSeenByAdmin: false },
      select: { id: true },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { category: true, teamSize: true, workingHours: true, slotIntervalMinutes: true } }),
  ])
  const newlyConfirmedIds = newlyConfirmed.map((b) => b.id)

  await prisma.booking.updateMany({ where: { businessId, confirmationSeenByAdmin: false }, data: { confirmationSeenByAdmin: true } })

  const isMultiPractitioner = (business?.teamSize ?? 1) > 1

  const [bookings, customers, services, blockedSlots, practitioners] = await Promise.all([
    prisma.booking.findMany({
      where: {
        businessId,
        ...(status ? { status: status as any } : {}),
        ...(q
          ? { customer: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }] } }
          : {}),
      },
      include: { customer: true, service: true, resource: true, practitioner: true },
      orderBy: { startAt: 'desc' },
      take: 200,
    }),
    prisma.customer.findMany({ where: { businessId }, orderBy: { name: 'asc' } }),
    prisma.service.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } }),
    prisma.blockedSlot.findMany({ where: { businessId } }),
    isMultiPractitioner
      ? prisma.practitioner.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ])

  return (
    <ProgramariManager
      newlyConfirmedIds={newlyConfirmedIds}
      category={business?.category ?? 'SALON'}
      isMultiPractitioner={isMultiPractitioner}
      bookings={bookings.map((b) => ({
        id: b.id,
        sequenceNumber: b.sequenceNumber,
        customerName: b.customer.name ?? b.customer.phone ?? 'Fără nume',
        customerPhone: b.customer.phone ?? '',
        customerId: b.customerId,
        serviceName: b.service.name,
        serviceId: b.serviceId,
        resourceName: b.resource?.name ?? null,
        practitionerName: b.practitioner?.name ?? null,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        status: b.status,
        channel: b.channel,
        confirmationRequestSent: b.confirmationRequestSent,
        customerConfirmed: b.customerConfirmed,
      }))}
      customers={customers.map((c) => ({ id: c.id, name: c.name ?? c.phone ?? 'Fără nume' }))}
      services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin }))}
      blockedSlots={blockedSlots.map((b) => ({ startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString() }))}
      practitioners={practitioners.map((p) => ({ id: p.id, name: p.name }))}
      workingHours={(business?.workingHours ?? []).map((range) => ({ weekday: range.weekday, startTime: range.startTime, endTime: range.endTime }))}
      slotIntervalMinutes={
        business?.category === 'EVENT_VENUE'
          ? 60
          : calculateAdaptiveSlotStep(services.map((service) => service.durationMin), business?.slotIntervalMinutes)
      }
      filters={{ status: status ?? '', q: q ?? '' }}
    />
  )
}
