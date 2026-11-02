import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDeerBorderouStorage, saveDeerBorderou } from '@/lib/deer-borderou'

const schema = z.object({
  connectionId: z.string().uuid(),
  documentPathname: z.string().min(10).max(1000).refine((value) => value.startsWith('formulare/deer/borderou/')),
  documentName: z.string().min(1).max(255).refine((value) => /\.pdf$/i.test(value)),
})

export async function POST(request: Request) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate încărca borderouri.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele borderoului sunt invalide.' }, { status: 400 })
  const { connectionId, documentPathname, documentName } = parsed.data
  const cases = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ConnectionCase" WHERE "businessId"=${businessId} AND "id"=${connectionId} LIMIT 1`
  if (!cases.length) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  const id = await saveDeerBorderou({ businessId, connectionId, documentPathname, documentName, source: 'UPLOAD' })
  return NextResponse.json({ id })
}

export async function PATCH(request: Request) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate asocia borderouri.' }, { status: 403 })
  const parsed = z.object({ id: z.string().uuid(), connectionId: z.string().uuid() }).safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await ensureDeerBorderouStorage()
  const { id, connectionId } = parsed.data
  const caseRows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ConnectionCase" WHERE "businessId"=${businessId} AND "id"=${connectionId} LIMIT 1`
  if (!caseRows.length) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  const updated = await prisma.$executeRaw`
    UPDATE "DeerBorderou" SET "connectionId"=${connectionId} WHERE "id"=${id} AND "businessId"=${businessId} AND "connectionId" IS NULL
  `
  if (!updated) return NextResponse.json({ error: 'Borderou inexistent.' }, { status: 404 })
  return NextResponse.json({ success: true })
}
