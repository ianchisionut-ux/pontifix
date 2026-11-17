import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureInternalChatStorage } from '@/lib/ensure-internal-chat-storage'
import { internalChatPushConfigured } from '@/lib/internal-chat-push'

export const dynamic = 'force-dynamic'

async function access() {
  const session = await auth()
  const businessId = (session as { businessId?: string } | null)?.businessId
  const userId = (session as { userId?: string } | null)?.userId
  return businessId && userId ? { businessId, userId } : null
}

export async function GET() {
  if (!await access()) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  return NextResponse.json({ publicKey: internalChatPushConfigured() ? process.env.SONERIE_VAPID_PUBLIC_KEY : null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  const current = await access()
  if (!current) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!internalChatPushConfigured()) return NextResponse.json({ error: 'Notificările push nu sunt configurate.' }, { status: 503 })

  const subscription = await request.json().catch(() => null)
  if (typeof subscription?.endpoint !== 'string' || !subscription.endpoint.startsWith('https://') ||
      subscription.endpoint.length > 2048 || typeof subscription?.keys?.p256dh !== 'string' ||
      typeof subscription?.keys?.auth !== 'string') return NextResponse.json({ error: 'Abonare invalidă.' }, { status: 400 })

  await ensureInternalChatStorage()
  await prisma.$executeRaw`
    INSERT INTO "InternalChatPushSubscription" ("endpoint", "userId", "businessId", "subscription")
    VALUES (${subscription.endpoint}, ${current.userId}, ${current.businessId}, ${JSON.stringify(subscription)}::jsonb)
    ON CONFLICT ("endpoint") DO UPDATE SET "userId"=EXCLUDED."userId", "businessId"=EXCLUDED."businessId",
      "subscription"=EXCLUDED."subscription", "updatedAt"=CURRENT_TIMESTAMP`
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  const current = await access()
  if (!current) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'Abonare invalidă.' }, { status: 400 })
  await ensureInternalChatStorage()
  await prisma.$executeRaw`DELETE FROM "InternalChatPushSubscription" WHERE "endpoint"=${body.endpoint} AND "userId"=${current.userId}`
  return NextResponse.json({ ok: true })
}
