import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSonerieStorage, getSonerieRole, latestCall, sameOrigin } from '@/lib/sonerie'

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  if (await getSonerieRole() !== 'ionut') return NextResponse.json({ error: 'Doar Ionuț poate confirma.' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (typeof body?.id !== 'string' || !/^[\da-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: 'Chemare invalidă.' }, { status: 400 })
  await ensureSonerieStorage()
  await prisma.$executeRaw`UPDATE "SonerieCall" SET "acknowledgedAt"=CURRENT_TIMESTAMP WHERE "id"=${body.id} AND "acknowledgedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP`
  return NextResponse.json({ call: await latestCall() }, { headers: { 'Cache-Control': 'no-store' } })
}
