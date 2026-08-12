import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { ensureVenueService } from '@/lib/venue-services'

const schema = z.object({
  name: z.string().min(1),
  capacity: z.number().nullable(),
  basePrice: z.number().nullable(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const resource = await prisma.resource.create({ data: { businessId, ...parsed.data } })
  await ensureVenueService(resource)
  return NextResponse.json({ resource })
}
