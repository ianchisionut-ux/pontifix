import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({ reply: z.string().max(1000).nullable() })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const review = await prisma.review.findUnique({ where: { id } })
  if (!review || review.businessId !== businessId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })

  await prisma.review.update({ where: { id }, data: { reply: parsed.data.reply } })

  return NextResponse.json({ success: true })
}
