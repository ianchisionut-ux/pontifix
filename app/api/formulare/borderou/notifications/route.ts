import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDeerBorderouStorage } from '@/lib/deer-borderou'

export async function PATCH(request: Request) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Acces interzis.' }, { status: 403 })
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Document invalid.' }, { status: 400 })
  await ensureDeerBorderouStorage()
  const updated = await prisma.$executeRaw`
    UPDATE "DeerBorderou" SET "notificationStatus"='READ'
    WHERE "id"=${parsed.data.id} AND "businessId"=${businessId} AND "source"='EMAIL'
  `
  return NextResponse.json({ success: updated > 0 })
}
