import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { hasActiveBookingConflict, isIntervalBlocked, isWithinWorkingHours } from '@/lib/availability'
import { getNextSequenceNumber } from '@/lib/booking-number'
import { z } from 'zod'
import { syncBookingToGoogle } from '@/lib/google-calendar'

const schema = z
  .object({
    customerId: z.string().optional(),
    customerName: z.string().min(1).optional(),
    customerPhone: z.string().min(6).optional(),
    serviceId: z.string(),
    staffId: z.string().nullable().optional(),
    resourceId: z.string().nullable().optional(),
    practitionerId: z.string().nullable().optional(),
    startAt: z.string(),
    endAt: z.string(),
    status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
  })
  .refine((data) => data.customerId || (data.customerName && data.customerPhone), {
    message: 'Alege un client existent sau completează numele și telefonul pentru unul nou.',
  })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const startDate = new Date(parsed.data.startAt)
  const endDate = new Date(parsed.data.endAt)

  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
    return NextResponse.json({ error: 'Intervalul programării nu este valid.' }, { status: 400 })
  }

  const [service, customer, practitioner, staff, resource] = await Promise.all([
    prisma.service.findFirst({ where: { id: parsed.data.serviceId, businessId, active: true } }),
    parsed.data.customerId ? prisma.customer.findFirst({ where: { id: parsed.data.customerId, businessId } }) : null,
    parsed.data.practitionerId
      ? prisma.practitioner.findFirst({ where: { id: parsed.data.practitionerId, businessId, active: true } })
      : null,
    parsed.data.staffId ? prisma.staff.findFirst({ where: { id: parsed.data.staffId, businessId, active: true } }) : null,
    parsed.data.resourceId ? prisma.resource.findFirst({ where: { id: parsed.data.resourceId, businessId } }) : null,
  ])
  if (!service) return NextResponse.json({ error: 'Serviciul selectat nu este disponibil.' }, { status: 404 })
  if (parsed.data.customerId && !customer) return NextResponse.json({ error: 'Clientul selectat nu a fost găsit.' }, { status: 404 })
  if (parsed.data.practitionerId && !practitioner) return NextResponse.json({ error: 'Profilul selectat nu este disponibil.' }, { status: 404 })
  if (parsed.data.staffId && !staff) return NextResponse.json({ error: 'Membrul selectat nu este disponibil.' }, { status: 404 })
  if (parsed.data.resourceId && !resource) return NextResponse.json({ error: 'Resursa selectată nu este disponibilă.' }, { status: 404 })

  const expectedEnd = new Date(startDate.getTime() + (service.durationMin ?? 30) * 60000)
  if (endDate.getTime() !== expectedEnd.getTime()) {
    return NextResponse.json({ error: 'Durata programării trebuie să rămână egală cu durata serviciului.' }, { status: 400 })
  }

  if (startDate < new Date()) {
    return NextResponse.json({ error: 'Nu poți crea o rezervare într-un interval din trecut.' }, { status: 400 })
  }

  if (await isIntervalBlocked(businessId, startDate, endDate)) {
    return NextResponse.json({ error: 'Intervalul selectat este blocat pentru rezervări.' }, { status: 409 })
  }

  if (!(await isWithinWorkingHours(businessId, parsed.data.practitionerId, startDate, endDate))) {
    return NextResponse.json({ error: 'Intervalul este în afara programului de lucru sau se suprapune peste o pauză.' }, { status: 409 })
  }

  if (await hasActiveBookingConflict(businessId, parsed.data.practitionerId, startDate, endDate)) {
    return NextResponse.json({ error: 'Intervalul se suprapune cu o altă programare.' }, { status: 409 })
  }

  // client existent (ales din listă) sau creat/regăsit pe loc, după numărul de telefon —
  // ca administratorul să nu mai trebuiască să treacă prin /Clienti separat
  let customerId = parsed.data.customerId
  if (customerId && (parsed.data.customerName || parsed.data.customerPhone)) {
    // clientul era deja cunoscut, dar adminul a corectat/actualizat numele sau
    // telefonul direct din formular (ex: din programarea rapidă în chat) — salvăm
    // modificarea pe fișa clientului, nu o ignorăm
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(parsed.data.customerName ? { name: parsed.data.customerName } : {}),
        ...(parsed.data.customerPhone ? { phone: parsed.data.customerPhone } : {}),
      },
    })
  } else if (!customerId && parsed.data.customerPhone) {
    const existing = await prisma.customer.findFirst({ where: { businessId, phone: parsed.data.customerPhone } })
    if (existing) {
      customerId = existing.id
      if (parsed.data.customerName && !existing.name) {
        await prisma.customer.update({ where: { id: existing.id }, data: { name: parsed.data.customerName } })
      }
    } else {
      const created = await prisma.customer.create({
        data: { businessId, name: parsed.data.customerName, phone: parsed.data.customerPhone },
      })
      customerId = created.id
    }
  }

  const sequenceNumber = await getNextSequenceNumber(businessId, new Date())

  const booking = await prisma.booking.create({
    data: {
      businessId,
      customerId: customerId!,
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId ?? null,
      resourceId: parsed.data.resourceId ?? null,
      practitionerId: parsed.data.practitionerId ?? null,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      status: parsed.data.status ?? 'CONFIRMED',
      channel: 'MANUAL', // rezervare adăugată manual de admin din dashboard, nu de client prin bot
      sequenceNumber,
    },
  })

  await syncBookingToGoogle(booking.id).catch((error) => console.error('[google-calendar] sync create:', error))

  return NextResponse.json({ booking })
}
