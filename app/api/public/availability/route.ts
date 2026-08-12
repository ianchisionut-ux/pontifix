import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAvailableSlots, getDaySlotsWithStatus, getPractitionerDaySlotsWithStatus, getVenueDaySlotsWithStatus } from '@/lib/availability'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = rateLimit(`public-availability:${ip}`, 60, 60 * 1000) // 60/minut/IP — generos pt navigare normală
  if (!allowed) {
    return NextResponse.json({ error: 'Prea multe cereri. Așteaptă puțin.' }, { status: 429 })
  }

  const businessId = req.nextUrl.searchParams.get('businessId')
  const serviceId = req.nextUrl.searchParams.get('serviceId')
  const dateParam = req.nextUrl.searchParams.get('date') // 'YYYY-MM-DD'
  const practitionerId = req.nextUrl.searchParams.get('practitionerId') // opțional — doar pentru clinici

  const resourceId = req.nextUrl.searchParams.get('resourceId')
  const durationMinutes = Number(req.nextUrl.searchParams.get('durationMinutes') ?? 60)

  if (!businessId || !serviceId || !dateParam) {
    return NextResponse.json({ error: 'Parametri lipsă' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business || !business.publicListed) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // parsăm explicit ca UTC (sufix Z) — indiferent de fusul cu care rulează efectiv
  // procesul Node.js pe server, ziua calendaristică rămâne mereu cea corectă
  const date = new Date(`${dateParam}T00:00:00Z`)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  if (date < todayStart) {
    return NextResponse.json({ slots: [], allSlots: [] })
  }

  if (resourceId) {
    const allSlots = await getVenueDaySlotsWithStatus(businessId, resourceId, date, durationMinutes)
    return NextResponse.json({ slots: allSlots.filter((slot) => slot.available).map((slot) => slot.time), allSlots })
  }

  if (practitionerId) {
    const allSlots = await getPractitionerDaySlotsWithStatus(businessId, serviceId, practitionerId, date)
    return NextResponse.json({ slots: allSlots.filter((s) => s.available).map((s) => s.time), allSlots })
  }

  const [slots, allSlots] = await Promise.all([
    getAvailableSlots(businessId, serviceId, date),
    getDaySlotsWithStatus(businessId, serviceId, date),
  ])

  return NextResponse.json({ slots, allSlots })
}
