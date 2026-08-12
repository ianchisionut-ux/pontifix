import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId')
  const serviceId = req.nextUrl.searchParams.get('serviceId')
  if (!businessId || !serviceId) return NextResponse.json({ error: 'Parametri lipsă' }, { status: 400 })

  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId, active: true }, select: { id: true } })
  if (!service) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const associations = await prisma.servicePractitioner.findMany({
    where: { serviceId, practitioner: { businessId, active: true } },
    include: { practitioner: true },
  })

  const eligible = associations.length > 0
    ? associations.map((a) => a.practitioner)
    : await prisma.practitioner.findMany({ where: { businessId, active: true } })

  return NextResponse.json({
    practitioners: eligible.map((p) => ({ id: p.id, name: p.name, specialization: p.specialization })),
  })
}
