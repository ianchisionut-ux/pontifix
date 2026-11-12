import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callView, ensureSonerieStorage, getSonerieRole, latestCall, sameOrigin } from '@/lib/sonerie'
import { notifyIonut } from '@/lib/sonerie-push'

export const dynamic = 'force-dynamic'

export async function GET() {
  const role = await getSonerieRole()
  if (!role) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  return NextResponse.json({ role, call: callView(await latestCall()) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  if (await getSonerieRole() !== 'director') return NextResponse.json({ error: 'Doar directorul poate chema.' }, { status: 403 })
  await ensureSonerieStorage()
  const previous = await latestCall()
  if (previous && !previous.acknowledgedAt && previous.expiresAt.getTime() > Date.now()) {
    return NextResponse.json({ call: callView(previous), repeated: true })
  }
  const id = crypto.randomUUID()
  await prisma.$executeRaw`INSERT INTO "SonerieCall" ("id", "expiresAt") VALUES (${id}, ${new Date(Date.now() + 3 * 60_000)})`
  // PWA-ul deschis interoghează periodic; Web Push trezește telefonul când este închis.
  await notifyIonut(id).catch(() => undefined)
  return NextResponse.json({ call: callView(await latestCall()) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
