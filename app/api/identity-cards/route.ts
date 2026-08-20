import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureIdentityCardStorage } from '@/lib/identity-card-storage'

const fields = {
  fullName: z.string().trim().min(2).max(180), cnp: z.string().trim().max(20),
  series: z.string().trim().max(10), number: z.string().trim().max(20),
  domicile: z.string().trim().max(500), issuedBy: z.string().trim().max(180),
  validFrom: z.string().trim().max(30), validUntil: z.string().trim().max(30),
  connectionCaseId: z.string().trim().nullable().optional(),
}
const schema = z.object(fields)

export async function POST(request: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role === 'STAFF') return NextResponse.json({ error: 'Cont cu acces doar pentru vizualizare.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Verifică numele și datele CI.' }, { status: 400 })
  await ensureIdentityCardStorage()
  const connectionCaseId = parsed.data.connectionCaseId || null
  if (connectionCaseId) {
    const connection = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ConnectionCase" WHERE "id"=${connectionCaseId} AND "businessId"=${businessId} LIMIT 1`
    if (!connection[0]) return NextResponse.json({ error: 'Branșamentul selectat nu există.' }, { status: 404 })
    await prisma.$executeRaw`UPDATE "IdentityCardRecord" SET "connectionCaseId"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE "businessId"=${businessId} AND "connectionCaseId"=${connectionCaseId}`
  }
  const id = crypto.randomUUID()
  const data = parsed.data
  await prisma.$executeRaw`INSERT INTO "IdentityCardRecord" ("id","businessId","connectionCaseId","fullName","cnp","series","number","domicile","issuedBy","validFrom","validUntil") VALUES (${id},${businessId},${connectionCaseId},${data.fullName},${data.cnp},${data.series},${data.number},${data.domicile},${data.issuedBy},${data.validFrom},${data.validUntil})`
  return NextResponse.json({ id }, { status: 201 })
}