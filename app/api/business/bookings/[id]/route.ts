import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { hasActiveBookingConflict, isIntervalBlocked, isWithinWorkingHours } from '@/lib/availability'
import { z } from 'zod'
import { syncBookingToGoogle } from '@/lib/google-calendar'

const schema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  staffId: z.string().nullable().optional(),
  resourceId: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
})

async function assertOwnership(id: string, businessId: string) {
  const booking = await prisma.booking.findUnique({ where: { id } })
  return booking && booking.businessId === businessId ? booking : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId
  const owned = await assertOwnership(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [staff, resource] = await Promise.all([
    parsed.data.staffId ? prisma.staff.findFirst({ where: { id: parsed.data.staffId, businessId, active: true } }) : null,
    parsed.data.resourceId ? prisma.resource.findFirst({ where: { id: parsed.data.resourceId, businessId } }) : null,
  ])
  if (parsed.data.staffId && !staff) return NextResponse.json({ error: 'Membrul selectat nu este disponibil.' }, { status: 404 })
  if (parsed.data.resourceId && !resource) return NextResponse.json({ error: 'Resursa selectată nu este disponibilă.' }, { status: 404 })

  if (parsed.data.endAt && !parsed.data.startAt) {
    return NextResponse.json({ error: 'Durata programării nu poate fi modificată.' }, { status: 400 })
  }

  if (parsed.data.startAt) {
    const newStart = new Date(parsed.data.startAt)
    const duration = owned.endAt.getTime() - owned.startAt.getTime()
    const newEnd = new Date(newStart.getTime() + duration)

    if (!Number.isFinite(newStart.getTime()) || duration <= 0) {
      return NextResponse.json({ error: 'Intervalul programării nu este valid.' }, { status: 400 })
    }
    if (parsed.data.endAt && new Date(parsed.data.endAt).getTime() !== newEnd.getTime()) {
      return NextResponse.json({ error: 'Durata programării nu poate fi modificată.' }, { status: 400 })
    }

    // verificăm "mutare în trecut" doar dacă ora CHIAR se schimbă — editarea statusului
    // (ex: marcare "Finalizată") pe o rezervare deja trecută retrimite același startAt
    // neschimbat și nu trebuie blocată niciodată
    const startAtActuallyChanged = newStart.getTime() !== owned.startAt.getTime()

    if (startAtActuallyChanged && newStart < new Date()) {
      return NextResponse.json({ error: 'Nu poți muta o rezervare într-un interval din trecut.' }, { status: 400 })
    }

    if (await isIntervalBlocked(businessId, newStart, newEnd)) {
      return NextResponse.json({ error: 'Intervalul selectat este blocat pentru rezervări.' }, { status: 409 })
    }

    if (startAtActuallyChanged && !(await isWithinWorkingHours(businessId, owned.practitionerId, newStart, newEnd))) {
      return NextResponse.json({ error: 'Intervalul este în afara programului de lucru sau se suprapune peste o pauză.' }, { status: 409 })
    }

    if (startAtActuallyChanged && await hasActiveBookingConflict(businessId, owned.practitionerId, newStart, newEnd, id)) {
      return NextResponse.json({ error: 'Intervalul se suprapune cu o altă programare.' }, { status: 409 })
    }

    parsed.data.endAt = newEnd.toISOString()
  }

  const becomesActive = parsed.data.status && ['PENDING', 'CONFIRMED'].includes(parsed.data.status) && !['PENDING', 'CONFIRMED'].includes(owned.status)
  if (becomesActive) {
    const activeStart = parsed.data.startAt ? new Date(parsed.data.startAt) : owned.startAt
    const activeEnd = parsed.data.endAt ? new Date(parsed.data.endAt) : owned.endAt
    if (await hasActiveBookingConflict(businessId, owned.practitionerId, activeStart, activeEnd, id)) {
      return NextResponse.json({ error: 'Programarea nu poate fi reactivată: intervalul este deja ocupat.' }, { status: 409 })
    }
    if (await isIntervalBlocked(businessId, activeStart, activeEnd) || !(await isWithinWorkingHours(businessId, owned.practitionerId, activeStart, activeEnd))) {
      return NextResponse.json({ error: 'Programarea nu poate fi reactivată în afara programului, într-o pauză sau într-un interval blocat.' }, { status: 409 })
    }
  }

  const data: Record<string, any> = { ...parsed.data }
  if (data.startAt) data.startAt = new Date(data.startAt)
  if (data.endAt) data.endAt = new Date(data.endAt)

  await prisma.booking.update({ where: { id }, data })
  await syncBookingToGoogle(id).catch((error) => console.error('[google-calendar] sync update:', error))
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId
  const owned = await assertOwnership(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // nu ștergem definitiv — anulăm, ca istoricul/statisticile să rămână corecte
  await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } })
  await syncBookingToGoogle(id).catch((error) => console.error('[google-calendar] sync cancel:', error))
  return NextResponse.json({ success: true })
}
