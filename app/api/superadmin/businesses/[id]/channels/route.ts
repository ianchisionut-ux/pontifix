import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const schema = z.object({
  type: z.enum(['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE_BUSINESS']),
  externalId: z.string().min(1),
  accessToken: z.string().optional(), // "lasă gol dacă nu schimbi" — obligatoriu doar la prima conectare
  wabaId: z.string().optional(),
  expiresInDays: z.number().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id: businessId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { type, externalId, accessToken, wabaId, expiresInDays } = parsed.data

  const existing = await prisma.channel.findUnique({ where: { type_externalId: { type, externalId } } })
  if (!existing && !accessToken) {
    return NextResponse.json({ error: 'Access Token e obligatoriu la prima conectare a canalului.' }, { status: 400 })
  }

  const channel = await prisma.channel.upsert({
    where: { type_externalId: { type, externalId } },
    create: {
      businessId,
      type,
      externalId,
      wabaId: wabaId || null,
      accessToken: encrypt(accessToken!),
      status: 'ACTIVE',
      enabledByOwner: true,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
    },
    update: {
      businessId,
      ...(wabaId ? { wabaId } : {}),
      ...(accessToken ? { accessToken: encrypt(accessToken) } : {}),
      status: 'ACTIVE',
      ...(expiresInDays ? { expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) } : {}),
    },
  })

  return NextResponse.json({ success: true, channelId: channel.id })
}
