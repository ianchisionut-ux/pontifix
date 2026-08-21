import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { ensureConnectionReceptionStorage } from '@/lib/connection-reception-storage'

const schema = z.object({
  year: z.number().int().min(2000).max(2100),
  orderNumber: z.number().int().min(1).max(99999).optional(),
  workType: z.string().trim().max(300).default(''),
  beneficiary: z.string().trim().max(300).default(''),
  location: z.string().trim().max(500).default(''),
  lot: z.string().trim().max(80).default(''),
  approvalNumber: z.string().trim().max(100).default(''),
  expirationDate: z.string().trim().max(40).default(''),
  received: z.boolean().default(false),
  notes: z.string().trim().max(2000).default(''),
})

export async function POST(request: NextRequest) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate adăuga recepții.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Verifică datele recepției.' }, { status: 400 })
  await ensureConnectionReceptionStorage(access.businessId)
  const data = parsed.data
  let orderNumber = data.orderNumber
  if (!orderNumber) {
    const rows = await prisma.$queryRaw<Array<{ next: number }>>`
      SELECT COALESCE(MAX("orderNumber"), 0)::int + 1 AS "next"
      FROM "ConnectionReception" WHERE "businessId"=${access.businessId} AND "year"=${data.year}
    `
    orderNumber = rows[0]?.next || 1
  }
  const id = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "ConnectionReception" (
      "id", "businessId", "year", "orderNumber", "workType", "beneficiary", "location",
      "lot", "approvalNumber", "expirationDate", "received", "receivedAt", "notes"
    ) VALUES (
      ${id}, ${access.businessId}, ${data.year}, ${orderNumber}, ${data.workType}, ${data.beneficiary}, ${data.location},
      ${data.lot}, ${data.approvalNumber}, ${data.expirationDate}, ${data.received},
      ${data.received ? new Date() : null}, ${data.notes}
    )
  `
  return NextResponse.json({ success: true, id }, { status: 201 })
}