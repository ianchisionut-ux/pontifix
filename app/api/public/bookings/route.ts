import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getDaySlotsWithStatus,
  getPractitionerDaySlotsWithStatus,
  getVenueDaySlotsWithStatus,
  isSlotStillAvailable,
  isIntervalBlocked,
  isWithinLeadTime,
  isPractitionerSlotStillAvailable,
  isWithinWorkingHours,
} from '@/lib/availability'
import { venueServiceId } from '@/lib/venue-services'
import { getNextSequenceNumber } from '@/lib/booking-number'
import { syncBookingToGoogle } from '@/lib/google-calendar'
import { createDepositCheckoutLink } from '@/lib/payments/create-checkout'
import { sendMessage } from '@/lib/channel-senders'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const schema = z.object({
  businessId: z.string(),
  serviceId: z.string(),
  practitionerId: z.string().optional(),
  resourceId: z.string().optional(),
  durationMinutes: z.number().int().min(60).max(720).optional(),
  startAt: z.string(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(6),
  paymentMethod: z.enum(['CASH', 'ONLINE']),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = rateLimit(`public-booking:${ip}`, 5, 10 * 60 * 1000) // 5 rezervări / 10 min / IP
  if (!allowed) {
    return NextResponse.json({ error: 'Prea multe încercări. Așteaptă câteva minute și încearcă din nou.' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide, verifică formularul.' }, { status: 400 })

  const { businessId, serviceId, practitionerId, resourceId: requestedResourceId, customerName, customerPhone, paymentMethod } = parsed.data

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business || !business.publicListed || !business.accountActive) {
    return NextResponse.json({ error: 'Afacerea nu este disponibilă pentru rezervări.' }, { status: 404 })
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service || service.businessId !== businessId || !service.active) {
    return NextResponse.json({ error: 'Serviciul nu mai este disponibil.' }, { status: 404 })
  }

  if (practitionerId) {
    const practitioner = await prisma.practitioner.findUnique({ where: { id: practitionerId } })
    if (!practitioner || practitioner.businessId !== businessId || !practitioner.active) {
      return NextResponse.json({ error: 'Medicul ales nu mai este disponibil.' }, { status: 404 })
    }
  }

  const startAt = new Date(parsed.data.startAt)
  if (!Number.isFinite(startAt.getTime()) || startAt < new Date()) {
    return NextResponse.json({ error: 'Nu poți rezerva un interval din trecut.' }, { status: 400 })
  }
  const venueDuration = parsed.data.durationMinutes ?? 60
  if (service.type === 'VENUE_RENTAL' && venueDuration % 60 !== 0) {
    return NextResponse.json({ error: 'Durata închirierii trebuie selectată în ore întregi.' }, { status: 400 })
  }
  const durationMinutes = service.type === 'VENUE_RENTAL' ? venueDuration : (service.durationMin ?? 30)
  const endAt = new Date(startAt.getTime() + durationMinutes * 60000)
  const localDateParam = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(startAt)
  const bookingDay = new Date(`${localDateParam}T00:00:00Z`)

  // verificare finală "ultima clipă" — cineva ar fi putut ocupa slotul chiar acum
  if (await isIntervalBlocked(businessId, startAt, endAt)) {
    return NextResponse.json({ error: 'Ne pare rău, intervalul tocmai a fost ocupat. Alege altă oră.' }, { status: 409 })
  }

  let resourceId: string | null = null

  if (service.type === 'APPOINTMENT') {
    if (await isWithinLeadTime(businessId, startAt)) {
      const business = await prisma.business.findUnique({ where: { id: businessId }, select: { minLeadTimeMinutes: true } })
      const hours = Math.round((business?.minLeadTimeMinutes ?? 120) / 60)
      return NextResponse.json(
        { error: `Rezervările online se fac cu minim ${hours} ${hours === 1 ? 'oră' : 'ore'} înainte. Sună direct pentru intervale mai apropiate.` },
        { status: 400 }
      )
    }

    const offeredSlots = practitionerId
      ? await getPractitionerDaySlotsWithStatus(businessId, serviceId, practitionerId, bookingDay)
      : await getDaySlotsWithStatus(businessId, serviceId, bookingDay)
    const wasOffered = offeredSlots.some((slot) => slot.available && new Date(slot.time).getTime() === startAt.getTime())
    if (!wasOffered) {
      return NextResponse.json({ error: 'Ora aleasă nu face parte din intervalele disponibile. Alege una dintre orele afișate.' }, { status: 409 })
    }

    const stillFree = practitionerId
      ? await isPractitionerSlotStillAvailable(businessId, serviceId, practitionerId, startAt)
      : await isSlotStillAvailable(businessId, serviceId, startAt)

    if (!stillFree) {
      return NextResponse.json({ error: 'Ne pare rău, intervalul tocmai a fost ocupat. Alege altă oră.' }, { status: 409 })
    }
  } else {
    if (!requestedResourceId || serviceId !== venueServiceId(requestedResourceId)) {
      return NextResponse.json({ error: 'Alege sala pe care vrei să o rezervi.' }, { status: 400 })
    }
    const resource = await prisma.resource.findFirst({
      where: {
        id: requestedResourceId,
        businessId,
      },
    })
    if (!resource) {
      return NextResponse.json({ error: 'Ne pare rău, data tocmai a fost ocupată. Alege altă zi.' }, { status: 409 })
    }
    const offeredSlots = await getVenueDaySlotsWithStatus(businessId, requestedResourceId, bookingDay, venueDuration)
    const wasOffered = offeredSlots.some((slot) => slot.available && new Date(slot.time).getTime() === startAt.getTime())
    if (!wasOffered) {
      return NextResponse.json({ error: 'Ora aleasă nu face parte din intervalele disponibile. Alege una dintre orele afișate.' }, { status: 409 })
    }
    if (await isWithinLeadTime(businessId, startAt)) {
      return NextResponse.json({ error: 'Rezervarea este prea apropiată de ora curentă. Alege un interval ulterior.' }, { status: 400 })
    }
    if (!(await isWithinWorkingHours(businessId, null, startAt, endAt))) {
      return NextResponse.json({ error: 'Intervalul este în afara programului de lucru sau se suprapune peste o pauză.' }, { status: 409 })
    }
    const conflict = await prisma.booking.findFirst({
      where: { resourceId: requestedResourceId, status: { in: ['CONFIRMED', 'PENDING'] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
      select: { id: true },
    })
    if (conflict) return NextResponse.json({ error: 'Sala este deja rezervată în acest interval. Alege altă oră.' }, { status: 409 })
    resourceId = resource.id
  }

  // clientul de pe web e identificat după telefon, la fel ca pe WhatsApp — dacă a mai
  // rezervat vreodată (indiferent de canal), îl recunoaștem pe același număr
  const customer = await prisma.customer.upsert({
    where: { businessId_phone: { businessId, phone: customerPhone } },
    create: { businessId, name: customerName, phone: customerPhone },
    update: { name: customerName },
  })

  const sequenceNumber = await getNextSequenceNumber(businessId, startAt)
  const wantsOnlinePayment = paymentMethod === 'ONLINE' && !!business.paymentProcessor

  const booking = await prisma.booking.create({
    data: {
      businessId,
      customerId: customer.id,
      serviceId,
      resourceId,
      practitionerId: practitionerId ?? null,
      startAt,
      endAt,
      status: 'PENDING',
      channel: 'WEB',
      sequenceNumber,
    },
  })
  await syncBookingToGoogle(booking.id).catch((error) => console.error('[google-calendar] sync public booking:', error))

  if (wantsOnlinePayment) {
    try {
      const checkoutUrl = await createDepositCheckoutLink(booking.id)
      return NextResponse.json({ bookingId: booking.id, checkoutUrl })
    } catch (err: any) {
      // plata nu s-a putut iniția — rezervarea rămâne PENDING, owner-ul poate confirma manual
      return NextResponse.json({ bookingId: booking.id, checkoutUrl: null, paymentError: err.message })
    }
  }

  // rezervarea pornește "În așteptare" — trimitem și un mesaj pe WhatsApp cu detaliile,
  // dacă businessul are canalul conectat. AȘTEPTĂM explicit trimiterea (nu fire-and-forget):
  // pe Vercel serverless, o promisiune neasteptată poate fi întreruptă înainte să se termine,
  // chiar dacă răspunsul a fost deja trimis către client — mesajul n-ar mai pleca niciodată.
  // Nu blocăm însă rezervarea dacă trimiterea eșuează — doar logăm eroarea.
  try {
    await sendWebBookingConfirmation(booking.id)
  } catch (err: any) {
    console.error('Eroare la trimiterea confirmării pe WhatsApp pentru rezervarea de pe site:', err?.message ?? err)
  }

  return NextResponse.json({ bookingId: booking.id, checkoutUrl: null })
}

async function sendWebBookingConfirmation(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, service: true, business: { include: { channels: true } } },
  })
  if (!booking || !booking.customer.phone) return

  const whatsappChannel = booking.business.channels.find((c) => c.type === 'WHATSAPP' && c.status === 'ACTIVE' && c.enabledByOwner)
  if (!whatsappChannel) return

  const dateTime = booking.startAt.toLocaleString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Bucharest',
  })

  // rezervarea e "În așteptare" până la reconfirmarea din ziua precedentă — mesajul
  // reflectă asta exact, nu mai spune "confirmată" ca să nu inducă în eroare clientul
  const text = `Am înregistrat programarea ta la ${booking.business.name}: ${booking.service.name}, pe ${dateTime}. Îți trimitem o cerere de confirmare cu o zi înainte.`

  await sendMessage({ channel: 'WHATSAPP', channelId: whatsappChannel.id, to: booking.customer.phone, text })
}
