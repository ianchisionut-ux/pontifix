import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { ensureWhatsAppStorage } from '@/lib/ensure-whatsapp-storage'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({ pin: z.string().regex(/^\d{6}$/, 'PIN-ul trebuie să aibă exact 6 cifre.') })

export async function POST(request: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId || (session as any)?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Doar Super Adminul poate înregistra numărul WhatsApp.' }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'PIN invalid.' }, { status: 400 })

  await ensureWhatsAppStorage()
  const channel = await prisma.channel.findFirst({ where: { businessId, type: 'WHATSAPP' } })
  if (!channel) return NextResponse.json({ error: 'Salvează mai întâi Phone Number ID, WABA ID și Access Token.' }, { status: 400 })
  if (!channel.wabaId) return NextResponse.json({ error: 'WABA ID lipsește din configurare.' }, { status: 400 })

  const accessToken = decrypt(channel.accessToken)
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

  const registerResponse = await fetch(`https://graph.facebook.com/v21.0/${channel.externalId}/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messaging_product: 'whatsapp', pin: parsed.data.pin }),
  })
  const registerResult = await registerResponse.json().catch(() => ({}))
  if (!registerResponse.ok) {
    return NextResponse.json({
      error: registerResult?.error?.error_user_msg || registerResult?.error?.message || `Meta a respins înregistrarea (${registerResponse.status}).`,
      metaCode: registerResult?.error?.code,
    }, { status: 400 })
  }

  const subscribeResponse = await fetch(`https://graph.facebook.com/v21.0/${channel.wabaId}/subscribed_apps`, {
    method: 'POST',
    headers,
  })
  const subscribeResult = await subscribeResponse.json().catch(() => ({}))
  await prisma.channel.update({ where: { id: channel.id }, data: { status: 'ACTIVE', enabledByOwner: true } })

  if (!subscribeResponse.ok) {
    return NextResponse.json({
      success: true,
      warning: registerResult?.success
        ? `Numărul a fost înregistrat, dar abonarea webhookului trebuie refăcută: ${subscribeResult?.error?.message || subscribeResponse.status}`
        : 'Numărul a fost înregistrat, dar abonarea webhookului trebuie verificată.',
    })
  }

  return NextResponse.json({ success: true, subscribed: true })
}
