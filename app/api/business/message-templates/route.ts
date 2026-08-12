import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({ title: z.string().min(1).max(60), text: z.string().min(1).max(1000) })

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const templates = await prisma.messageTemplate.findMany({ where: { businessId }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Completează titlul și textul.' }, { status: 400 })

  const template = await prisma.messageTemplate.create({ data: { businessId, ...parsed.data } })
  return NextResponse.json({ template })
}
