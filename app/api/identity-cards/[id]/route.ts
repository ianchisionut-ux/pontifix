import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureIdentityCardStorage } from '@/lib/identity-card-storage'

const patchSchema = z.object({
  connectionCaseId: z.string().trim().nullable().optional(),
  fullName: z.string().trim().min(2).max(180).optional(), cnp: z.string().trim().max(20).optional(),
  series: z.string().trim().max(10).optional(), number: z.string().trim().max(20).optional(),
  domicile: z.string().trim().max(500).optional(), issuedBy: z.string().trim().max(180).optional(),
  validFrom: z.string().trim().max(30).optional(), validUntil: z.string().trim().max(30).optional(),
})

async function access() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  return businessId && (session as any)?.role !== 'STAFF' ? businessId : null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await access()
  if (!businessId) return NextResponse.json({ error: 'Nu ai drept de modificare.' }, { status: 403 })
  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date CI invalide.' }, { status: 400 })
  await ensureIdentityCardStorage()
  const { id } = await params
  const current = await prisma.$queryRaw<Array<any>>`SELECT * FROM "IdentityCardRecord" WHERE "id"=${id} AND "businessId"=${businessId} LIMIT 1`
  if (!current[0]) return NextResponse.json({ error: 'Înregistrarea CI nu există.' }, { status: 404 })
  const next = { ...current[0], ...parsed.data }
  const connectionCaseId = next.connectionCaseId || null
  if (connectionCaseId) {
    const connection = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ConnectionCase" WHERE "id"=${connectionCaseId} AND "businessId"=${businessId} LIMIT 1`
    if (!connection[0]) return NextResponse.json({ error: 'Branșamentul selectat nu există.' }, { status: 404 })
    await prisma.$executeRaw`UPDATE "IdentityCardRecord" SET "connectionCaseId"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE "businessId"=${businessId} AND "connectionCaseId"=${connectionCaseId} AND "id"<>${id}`
  }
  await prisma.$executeRaw`UPDATE "IdentityCardRecord" SET "connectionCaseId"=${connectionCaseId}, "fullName"=${next.fullName}, "cnp"=${next.cnp}, "series"=${next.series}, "number"=${next.number}, "domicile"=${next.domicile}, "issuedBy"=${next.issuedBy}, "validFrom"=${next.validFrom}, "validUntil"=${next.validUntil}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${businessId}`
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await access()
  if (!businessId) return NextResponse.json({ error: 'Nu ai drept de ștergere.' }, { status: 403 })
  await ensureIdentityCardStorage()
  const { id } = await params
  await prisma.$executeRaw`DELETE FROM "IdentityCardRecord" WHERE "id"=${id} AND "businessId"=${businessId}`
  return NextResponse.json({ success: true })
}