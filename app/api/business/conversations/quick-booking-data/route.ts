import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { teamSize: true, workingHours: true, slotIntervalMinutes: true } })
  const isMultiPractitioner = (business?.teamSize ?? 1) > 1

  const [services, practitioners] = await Promise.all([
    prisma.service.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } }),
    isMultiPractitioner
      ? prisma.practitioner.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ])

  return NextResponse.json({
    isMultiPractitioner,
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin })),
    practitioners: practitioners.map((p) => ({ id: p.id, name: p.name })),
    workingHours: (business?.workingHours ?? []).map((range) => ({ weekday: range.weekday, startTime: range.startTime, endTime: range.endTime })),
    slotIntervalMinutes: business?.slotIntervalMinutes ?? 10,
  })
}
