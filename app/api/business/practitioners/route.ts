import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  specialization: z.string().optional(),
  bio: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })

  const practitioner = await prisma.practitioner.create({
    data: { businessId, name: parsed.data.name, specialization: parsed.data.specialization || null, bio: parsed.data.bio || null },
  })

  return NextResponse.json({ practitioner })
}
