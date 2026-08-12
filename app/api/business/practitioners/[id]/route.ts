import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  specialization: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  active: z.boolean().optional(),
  break1Start: z.string().nullable().optional(),
  break1End: z.string().nullable().optional(),
  break2Start: z.string().nullable().optional(),
  break2End: z.string().nullable().optional(),
  break3Start: z.string().nullable().optional(),
  break3End: z.string().nullable().optional(),
  workingHours: z
    .array(z.object({ weekday: z.number().min(0).max(6), startTime: z.string(), endTime: z.string() }))
    .optional(),
  serviceIds: z.array(z.string()).optional(),
})

async function ownsPractitioner(practitionerId: string, businessId: string) {
  const p = await prisma.practitioner.findUnique({ where: { id: practitionerId } })
  return p && p.businessId === businessId ? p : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await ownsPractitioner(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })

  const { workingHours, serviceIds, ...fields } = parsed.data

  if (serviceIds) {
    const uniqueServiceIds = [...new Set(serviceIds)]
    const ownedServices = await prisma.service.count({
      where: { id: { in: uniqueServiceIds }, businessId },
    })
    if (ownedServices !== uniqueServiceIds.length) {
      return NextResponse.json({ error: 'Unul sau mai multe servicii nu aparțin acestei afaceri.' }, { status: 400 })
    }
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(fields).length > 0) {
      await tx.practitioner.update({ where: { id }, data: fields })
    }
    if (workingHours) {
      await tx.practitionerWorkingHours.deleteMany({ where: { practitionerId: id } })
      if (workingHours.length > 0) {
        await tx.practitionerWorkingHours.createMany({
          data: workingHours.map((h) => ({ practitionerId: id, weekday: h.weekday, startTime: h.startTime, endTime: h.endTime })),
        })
      }
    }
    if (serviceIds) {
      await tx.servicePractitioner.deleteMany({ where: { practitionerId: id } })
      if (serviceIds.length > 0) {
        await tx.servicePractitioner.createMany({
          data: serviceIds.map((serviceId) => ({ practitionerId: id, serviceId })),
        })
      }
    }
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await ownsPractitioner(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const upcomingBookings = await prisma.booking.count({
    where: { practitionerId: id, status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: new Date() } },
  })
  if (upcomingBookings > 0) {
    return NextResponse.json(
      { error: `Această persoană are ${upcomingBookings} programări viitoare — anulează-le sau reprogramează-le mai întâi.` },
      { status: 409 }
    )
  }

  await prisma.$transaction([
    prisma.servicePractitioner.deleteMany({ where: { practitionerId: id } }),
    prisma.practitionerWorkingHours.deleteMany({ where: { practitionerId: id } }),
    prisma.practitioner.delete({ where: { id } }),
  ])

  return NextResponse.json({ success: true })
}
