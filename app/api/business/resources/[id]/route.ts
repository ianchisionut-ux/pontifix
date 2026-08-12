import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { ensureVenueService, venueServiceId } from '@/lib/venue-services'

const schema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().nullable().optional(),
  basePrice: z.number().nullable().optional(),
})

async function assertOwnership(id: string, businessId: string) {
  const resource = await prisma.resource.findUnique({ where: { id } })
  return resource && resource.businessId === businessId ? resource : null
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

  const resource = await prisma.resource.update({ where: { id }, data: parsed.data })
  await ensureVenueService(resource)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId
  const owned = await assertOwnership(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await prisma.$transaction([
    prisma.service.updateMany({ where: { id: venueServiceId(id), businessId }, data: { active: false } }),
    prisma.resource.delete({ where: { id } }),
  ])
  return NextResponse.json({ success: true })
}
