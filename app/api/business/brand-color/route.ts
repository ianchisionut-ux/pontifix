import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({ brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable() })

export async function PATCH(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Culoare invalidă.' }, { status: 400 })

  await prisma.business.update({ where: { id: businessId }, data: { brandColor: parsed.data.brandColor } })

  return NextResponse.json({ success: true })
}
