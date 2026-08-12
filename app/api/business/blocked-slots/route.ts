import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  reason: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const slots = await prisma.blockedSlot.findMany({ where: { businessId }, orderBy: { startAt: 'asc' } })
  return NextResponse.json({ slots })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const startAt = new Date(parsed.data.startAt)
  const endAt = new Date(parsed.data.endAt)
  if (endAt <= startAt) {
    return NextResponse.json({ error: 'Intervalul selectat nu e valid.' }, { status: 400 })
  }

  const slot = await prisma.blockedSlot.create({
    data: { businessId, startAt, endAt, reason: parsed.data.reason },
  })

  return NextResponse.json({ slot })
}
