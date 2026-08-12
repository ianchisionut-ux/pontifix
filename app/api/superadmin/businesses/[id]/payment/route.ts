import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const schema = z.object({
  paymentProcessor: z.enum(['STRIPE', 'NETOPIA', 'EUPLATESC']).nullable().optional(),

  stripeSecretKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),

  netopiaApiKey: z.string().optional(),
  netopiaPosSignature: z.string().optional(),
  netopiaPublicKey: z.string().optional(),
  netopiaIsLive: z.boolean().optional(),

  euplatescMerchantId: z.string().optional(),
  euplatescSecretKey: z.string().optional(),
  euplatescIsLive: z.boolean().optional(),
})

// câmpurile care se criptează dacă sunt trimise (chei/secrete) — restul (flag-uri boolean,
// selecția de procesor) se salvează direct
const ENCRYPTED_FIELDS = [
  'stripeSecretKey',
  'stripeWebhookSecret',
  'netopiaApiKey',
  'netopiaPosSignature',
  'netopiaPublicKey',
  'euplatescMerchantId',
  'euplatescSecretKey',
] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id: businessId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data: Record<string, any> = {}

  if (parsed.data.paymentProcessor !== undefined) data.paymentProcessor = parsed.data.paymentProcessor
  if (parsed.data.netopiaIsLive !== undefined) data.netopiaIsLive = parsed.data.netopiaIsLive
  if (parsed.data.euplatescIsLive !== undefined) data.euplatescIsLive = parsed.data.euplatescIsLive

  for (const field of ENCRYPTED_FIELDS) {
    const value = (parsed.data as any)[field]
    if (value) data[field] = encrypt(value)
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: true, note: 'nimic de actualizat' })
  }

  await prisma.business.update({ where: { id: businessId }, data })
  return NextResponse.json({ success: true })
}
