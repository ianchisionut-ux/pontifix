import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const schema = z.object({
  phoneNumberId: z.string().trim().min(5).max(100),
  wabaId: z.string().trim().max(100).optional(),
  accessToken: z.string().trim().max(5000).optional(),
  enabled: z.boolean(),
})

export async function PUT(request: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const role = (session as any)?.role
  if (!businessId || role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Doar Super Adminul poate configura WhatsApp.' }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Date invalide.' }, { status: 400 })

  const { phoneNumberId, wabaId, accessToken, enabled } = parsed.data
  const current = await prisma.channel.findFirst({ where: { businessId, type: 'WHATSAPP' } })
  if (!current && !accessToken) {
    return NextResponse.json({ error: 'Access Token este obligatoriu la prima configurare.' }, { status: 400 })
  }

  try {
    const data = {
      externalId: phoneNumberId,
      wabaId: wabaId || null,
      enabledByOwner: enabled,
      status: enabled ? 'ACTIVE' as const : 'DISCONNECTED' as const,
      ...(accessToken ? { accessToken: encrypt(accessToken) } : {}),
    }
    const channel = current
      ? await prisma.channel.update({ where: { id: current.id }, data })
      : await prisma.channel.create({
          data: {
            businessId,
            type: 'WHATSAPP',
            ...data,
            accessToken: encrypt(accessToken!),
          },
        })

    return NextResponse.json({ success: true, configured: !!channel.accessToken })
  } catch (error) {
    console.error('whatsapp settings update failed', error)
    return NextResponse.json({ error: 'Configurarea WhatsApp nu a putut fi salvată. Verifică ID-urile introduse.' }, { status: 500 })
  }
}
