import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).optional(),
  durationMin: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  active: z.boolean().optional(),
})

async function assertOwnership(id: string, businessId: string) {
  const service = await prisma.service.findUnique({ where: { id } })
  return service && service.businessId === businessId ? service : null
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

  await prisma.service.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId
  const owned = await assertOwnership(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await prisma.service.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
