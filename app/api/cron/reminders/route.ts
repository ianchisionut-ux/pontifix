import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendUnconfirmedBookingAlert } from '@/lib/email'
import { sendConfirmationRequest } from '@/lib/confirmation-request'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results = { dayBeforeSent: 0, twoHourSent: 0, unconfirmedAlerts: 0, failed: 0 }

  await sendDayBeforeReminders(now, results)
  await sendTwoHourReminders(now, results)
  await sendUnconfirmedAlerts(now, results)

  return NextResponse.json(results)
}

// ora Bucureștiului "acum", indiferent de fusul serverului
function bucharestNow(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  return {
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  }
}

// reminder-ul principal — orice programare PENDING pentru MÂINE (ziua calendaristică
// următoare, oră București) primește, o singură dată, la ora 16:00, un mesaj cu butoane
// de confirmare/anulare. Abia atunci devine CONFIRMED în sistem — nu automat la creare
async function sendDayBeforeReminders(now: Date, results: { dayBeforeSent: number; failed: number }) {
  const b = bucharestNow(now)
  // fereastra cron e la 15 min — declanșăm doar în intervalul 16:00–16:15, o singură dată pe zi
  if (b.hour !== 16 || b.minute >= 15) return

  const tomorrowStart = new Date(Date.UTC(b.year, b.month - 1, b.day + 1, 0, 0, 0) - 3 * 60 * 60 * 1000)
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: { status: 'PENDING', reminder24hSent: false, startAt: { gte: tomorrowStart, lt: tomorrowEnd } },
    include: { customer: true, service: true, business: { include: { channels: true } } },
  })

  for (const booking of bookings) {
    const { success } = await sendConfirmationRequest(booking)
    if (success) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminder24hSent: true, confirmationRequestSent: true },
      })
      results.dayBeforeSent++
    } else {
      results.failed++
    }
  }
}

// reminder scurt, informativ — cu 1 oră înainte, doar pentru programările deja
// CONFIRMED (cele reconfirmate cu o zi înainte) — fără butoane, doar o notă
async function sendTwoHourReminders(now: Date, results: { twoHourSent: number; failed: number }) {
  const windowStart = new Date(now.getTime() + 0.75 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 1.25 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', reminder1hSent: false, startAt: { gte: windowStart, lte: windowEnd } },
    include: { customer: true, service: true, business: { include: { channels: true } } },
  })

  for (const booking of bookings) {
    // la fel ca la cererea de reconfirmare — mereu pe WhatsApp, indiferent pe ce canal
    // a fost făcută programarea inițial
    const channel = booking.business.channels.find((c: any) => c.type === 'WHATSAPP' && c.status === 'ACTIVE' && c.enabledByOwner)
    if (!channel) {
      results.failed++
      continue
    }
    const text = `Programarea ta pentru ${booking.service.name} e peste 1 oră (${formatTime(booking.startAt)}). Te așteptăm!`
    try {
      const { sendMessage } = await import('@/lib/channel-senders')
      if (!booking.customer.phone) continue
      await sendMessage({ channel: 'WHATSAPP', channelId: channel.id, to: booking.customer.phone, text })
      await prisma.booking.update({ where: { id: booking.id }, data: { reminder1hSent: true } })
      results.twoHourSent++
    } catch {
      results.failed++
    }
  }
}

// dacă am cerut confirmare (reminder-ul de la 16:00) și clientul tot n-a răspuns, iar
// programarea e la mai puțin de 3 ore — anunțăm proprietarul, o dată
async function sendUnconfirmedAlerts(now: Date, results: { unconfirmedAlerts: number }) {
  const windowEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      confirmationRequestSent: true,
      customerConfirmed: null,
      unconfirmedAlertSent: false,
      startAt: { gte: now, lte: windowEnd },
    },
    include: { customer: true, service: true, business: { include: { users: { where: { role: 'OWNER' } } } } },
  })

  for (const booking of bookings) {
    const ownerEmail = booking.business.users[0]?.email
    if (!ownerEmail) continue

    await sendUnconfirmedBookingAlert({
      to: ownerEmail,
      businessName: booking.business.name,
      customerName: booking.customer.name ?? booking.customer.phone ?? 'Fără nume',
      customerPhone: booking.customer.phone ?? 'Nespecificat',
      serviceName: booking.service.name,
      startAt: booking.startAt,
    }).catch((err) => console.error('Eroare la alerta de neconfirmare:', err))

    await prisma.booking.update({ where: { id: booking.id }, data: { unconfirmedAlertSent: true } })
    results.unconfirmedAlerts++
  }
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' })
}
