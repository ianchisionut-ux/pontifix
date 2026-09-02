import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureInternalChatStorage } from '@/lib/ensure-internal-chat-storage'

export const dynamic = 'force-dynamic'

const signalSchema = z.object({
  recipientId: z.string().min(1),
  transferId: z.string().uuid(),
  type: z.enum(['offer', 'answer', 'ice', 'accept', 'reject', 'cancel']),
  payload: z.record(z.unknown()).default({}),
})

async function access() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const userId = (session as any)?.userId as string | undefined
  return businessId && userId ? { businessId, userId } : null
}

export async function GET() {
  const current = await access()
  if (!current) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureInternalChatStorage()
  await prisma.$executeRaw`DELETE FROM "InternalChatSignal" WHERE "createdAt" < CURRENT_TIMESTAMP - INTERVAL '20 minutes'`
  const rows = await prisma.$queryRaw<Array<{ id: string; senderId: string; transferId: string; type: string; payload: unknown; createdAt: Date }>>`
    SELECT "id","senderId","transferId","type","payload","createdAt"
    FROM "InternalChatSignal"
    WHERE "businessId"=${current.businessId} AND "recipientId"=${current.userId}
      AND "createdAt" > CURRENT_TIMESTAMP - INTERVAL '20 minutes'
    ORDER BY "createdAt" ASC LIMIT 300
  `
  return NextResponse.json({ signals: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })) })
}

export async function POST(request: NextRequest) {
  const current = await access()
  if (!current) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const parsed = signalSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Semnal de transfer invalid.' }, { status: 400 })
  if (parsed.data.recipientId === current.userId) return NextResponse.json({ error: 'Nu poți transfera către același cont.' }, { status: 400 })
  const payloadJson = JSON.stringify(parsed.data.payload)
  if (payloadJson.length > 120_000) return NextResponse.json({ error: 'Semnal prea mare.' }, { status: 413 })
  await ensureInternalChatStorage()
  const recipient = await prisma.user.findFirst({ where: { id: parsed.data.recipientId, businessId: current.businessId }, select: { id: true } })
  if (!recipient) return NextResponse.json({ error: 'Destinatar invalid.' }, { status: 400 })
  const id = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "InternalChatSignal" ("id","businessId","senderId","recipientId","transferId","type","payload")
    VALUES (${id},${current.businessId},${current.userId},${parsed.data.recipientId},${parsed.data.transferId},${parsed.data.type},${payloadJson}::jsonb)
  `
  return NextResponse.json({ success: true, id })
}
