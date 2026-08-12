import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  subject: z.string().min(2).max(120),
  message: z.string().min(5).max(2000),
})

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const tickets = await prisma.supportTicket.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ tickets })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Completează subiectul și mesajul.' }, { status: 400 })

  const ticket = await prisma.supportTicket.create({
    data: { businessId, subject: parsed.data.subject, message: parsed.data.message },
  })

  return NextResponse.json({ ticket })
}
