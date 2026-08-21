import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { ensureConnectionReceptionStorage } from '@/lib/connection-reception-storage'

const schema = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
  orderNumber: z.number().int().min(1).max(99999).optional(),
  workType: z.string().trim().max(300).optional(),
  beneficiary: z.string().trim().max(300).optional(),
  location: z.string().trim().max(500).optional(),
  lot: z.string().trim().max(80).optional(),
  approvalNumber: z.string().trim().max(100).optional(),
  expirationDate: z.string().trim().max(40).optional(),
  received: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
}).refine((value) => Object.keys(value).length > 0, 'Nicio modificare.')

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate modifica recepțiile.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await ensureConnectionReceptionStorage(access.businessId)
  const { id } = await params
  const current = await prisma.$queryRaw<Array<{ received: boolean }>>`
    SELECT "received" FROM "ConnectionReception" WHERE "id"=${id} AND "businessId"=${access.businessId} LIMIT 1
  `
  if (!current[0]) return NextResponse.json({ error: 'Recepție inexistentă.' }, { status: 404 })
  const data = parsed.data
  const receivedAt = data.received === undefined ? undefined : data.received ? new Date() : null
  await prisma.$executeRaw`
    UPDATE "ConnectionReception" SET
      "year"=COALESCE(${data.year ?? null}, "year"),
      "orderNumber"=COALESCE(${data.orderNumber ?? null}, "orderNumber"),
      "workType"=COALESCE(${data.workType ?? null}, "workType"),
      "beneficiary"=COALESCE(${data.beneficiary ?? null}, "beneficiary"),
      "location"=COALESCE(${data.location ?? null}, "location"),
      "lot"=COALESCE(${data.lot ?? null}, "lot"),
      "approvalNumber"=COALESCE(${data.approvalNumber ?? null}, "approvalNumber"),
      "expirationDate"=COALESCE(${data.expirationDate ?? null}, "expirationDate"),
      "received"=COALESCE(${data.received ?? null}, "received"),
      "receivedAt"=CASE WHEN ${receivedAt === undefined} THEN "receivedAt" ELSE ${receivedAt ?? null} END,
      "notes"=COALESCE(${data.notes ?? null}, "notes"),
      "updatedAt"=CURRENT_TIMESTAMP
    WHERE "id"=${id} AND "businessId"=${access.businessId}
  `
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate șterge recepții.' }, { status: 403 })
  await ensureConnectionReceptionStorage(access.businessId)
  const { id } = await params
  const changed = await prisma.$executeRaw`DELETE FROM "ConnectionReception" WHERE "id"=${id} AND "businessId"=${access.businessId}`
  if (!changed) return NextResponse.json({ error: 'Recepție inexistentă.' }, { status: 404 })
  return NextResponse.json({ success: true })
}