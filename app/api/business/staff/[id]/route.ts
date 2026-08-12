import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({ name: z.string().min(1).optional(), active: z.boolean().optional() })

async function assertOwnership(id: string, businessId: string) {
  const staff = await prisma.staff.findUnique({ where: { id } })
  return staff && staff.businessId === businessId ? staff : null
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

  await prisma.staff.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId
  const owned = await assertOwnership(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // nu ștergem definitiv dacă are rezervări asociate (ar rupe istoricul) — doar dezactivăm
  const hasBookings = await prisma.booking.findFirst({ where: { staffId: id } })
  if (hasBookings) {
    await prisma.staff.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ success: true, deactivatedInstead: true })
  }

  await prisma.staff.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
