import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSonerieStorage, getSonerieRole, sameOrigin } from '@/lib/sonerie'

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cerere invalidă.' }, { status: 403 })
  if (await getSonerieRole() !== 'ionut') return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) {
    return NextResponse.json({ error: 'Chemare invalidă.' }, { status: 400 })
  }
  await ensureSonerieStorage()
  await prisma.$executeRaw`UPDATE "SonerieCall" SET "pushReceivedAt"=COALESCE("pushReceivedAt", CURRENT_TIMESTAMP) WHERE "id"=${body.id}`
  return NextResponse.json({ ok: true })
}
