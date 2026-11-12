import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSonerieStorage, getSonerieRole, sameOrigin } from '@/lib/sonerie'
import { pushConfigured } from '@/lib/sonerie-push'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (await getSonerieRole() !== 'ionut') return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  return NextResponse.json({ publicKey: pushConfigured() ? process.env.SONERIE_VAPID_PUBLIC_KEY : null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  if (await getSonerieRole() !== 'ionut') return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const subscription = await request.json().catch(() => null)
  if (typeof subscription?.endpoint !== 'string' || !subscription.endpoint.startsWith('https://') ||
      subscription.endpoint.length > 2048 || typeof subscription?.keys?.p256dh !== 'string' ||
      typeof subscription?.keys?.auth !== 'string') return NextResponse.json({ error: 'Abonare invalidă.' }, { status: 400 })
  await ensureSonerieStorage()
  await prisma.$executeRaw`INSERT INTO "SoneriePushSubscription" ("endpoint", "recipient", "subscription")
    VALUES (${subscription.endpoint}, 'ionut', ${JSON.stringify(subscription)}::jsonb)
    ON CONFLICT ("endpoint") DO UPDATE SET "subscription"=EXCLUDED."subscription", "updatedAt"=CURRENT_TIMESTAMP`
  return NextResponse.json({ ok: true })
}
