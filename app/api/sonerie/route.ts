import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callView, ensureSonerieStorage, getIonutAvailability, getSonerieRole, latestCall, sameOrigin } from '@/lib/sonerie'
import { notifyIonut } from '@/lib/sonerie-push'

export const dynamic = 'force-dynamic'

export async function GET() {
  const role = await getSonerieRole()
  if (!role) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const [call, available] = await Promise.all([latestCall(), getIonutAvailability()])
  return NextResponse.json({ role, call: callView(call), available }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  if (await getSonerieRole() !== 'director') return NextResponse.json({ error: 'Doar directorul poate chema.' }, { status: 403 })
  await ensureSonerieStorage()
  if (!await getIonutAvailability()) return NextResponse.json({ error: 'Ionuț a marcat că nu este disponibil.' }, { status: 409 })
  const previous = await latestCall()
  if (previous && !previous.acknowledgedAt && previous.expiresAt.getTime() > Date.now()) {
    return NextResponse.json({ call: callView(previous), repeated: true })
  }
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 3 * 60_000)
  await prisma.$executeRaw`INSERT INTO "SonerieCall" ("id", "expiresAt") VALUES (${id}, ${expiresAt})`
  // PWA-ul deschis interoghează periodic; Web Push trezește telefonul când este închis.
  const push = await notifyIonut(id, expiresAt).catch((error) => {
    console.warn('sonerie_push_failed', { callId: id, reason: error instanceof Error ? error.name : 'unknown' })
    return { status: 'failed', queued: false }
  })
  await prisma.$executeRaw`UPDATE "SonerieCall" SET "pushStatus"=${push.status}, "pushQueuedAt"=${push.queued ? new Date() : null} WHERE "id"=${id}`
    .catch((error) => console.warn('sonerie_push_status_failed', { callId: id, reason: error instanceof Error ? error.name : 'unknown' }))
  return NextResponse.json({ call: callView(await latestCall()) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  if (await getSonerieRole() !== 'ionut') return NextResponse.json({ error: 'Doar Ionuț poate schimba disponibilitatea.' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (typeof body?.available !== 'boolean') return NextResponse.json({ error: 'Stare invalidă.' }, { status: 400 })
  await ensureSonerieStorage()
  await prisma.$executeRaw`INSERT INTO "SoneriePresence" ("person", "available") VALUES ('ionut', ${body.available})
    ON CONFLICT ("person") DO UPDATE SET "available"=EXCLUDED."available", "updatedAt"=CURRENT_TIMESTAMP`
  if (!body.available) {
    await prisma.$executeRaw`UPDATE "SonerieCall" SET "acknowledgedAt"=CURRENT_TIMESTAMP, "response"='unavailable'
      WHERE "acknowledgedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP`
  }
  return NextResponse.json({ available: body.available, call: callView(await latestCall()) }, { headers: { 'Cache-Control': 'no-store' } })
}
