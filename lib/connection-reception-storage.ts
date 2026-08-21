import { prisma } from '@/lib/prisma'

export type ConnectionReceptionDto = {
  id: string
  year: number
  orderNumber: number
  workType: string
  beneficiary: string
  location: string
  lot: string
  approvalNumber: string
  expirationDate: string
  received: boolean
  receivedAt: string | null
  notes: string
  sourceKey: string | null
  createdAt: string
  updatedAt: string
}

const readyByBusiness = new Map<string, Promise<void>>()

export function ensureConnectionReceptionStorage(businessId: string) {
  const existing = readyByBusiness.get(businessId)
  if (existing) return existing
  const operation = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ConnectionReception" (
        "id" TEXT PRIMARY KEY,
        "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
        "sourceKey" TEXT,
        "year" INTEGER NOT NULL,
        "orderNumber" INTEGER NOT NULL,
        "workType" TEXT NOT NULL DEFAULT '',
        "beneficiary" TEXT NOT NULL DEFAULT '',
        "location" TEXT NOT NULL DEFAULT '',
        "lot" TEXT NOT NULL DEFAULT '',
        "approvalNumber" TEXT NOT NULL DEFAULT '',
        "expirationDate" TEXT NOT NULL DEFAULT '',
        "received" BOOLEAN NOT NULL DEFAULT false,
        "receivedAt" TIMESTAMP(3),
        "notes" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ConnectionReception_business_source_key"
      ON "ConnectionReception" ("businessId", "sourceKey")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ConnectionReception_business_year_order_idx"
      ON "ConnectionReception" ("businessId", "year" DESC, "orderNumber" DESC)
    `)

  })().catch((error) => {
    readyByBusiness.delete(businessId)
    throw error
  })
  readyByBusiness.set(businessId, operation)
  return operation
}

export async function listConnectionReceptions(businessId: string): Promise<ConnectionReceptionDto[]> {
  await ensureConnectionReceptionStorage(businessId)
  const rows = await prisma.$queryRaw<Array<Omit<ConnectionReceptionDto, 'receivedAt' | 'createdAt' | 'updatedAt'> & { receivedAt: Date | null; createdAt: Date; updatedAt: Date }>>`
    SELECT "id", "year", "orderNumber", "workType", "beneficiary", "location", "lot",
      "approvalNumber", "expirationDate", "received", "receivedAt", "notes", "sourceKey", "createdAt", "updatedAt"
    FROM "ConnectionReception"
    WHERE "businessId"=${businessId}
    ORDER BY "year" DESC, "orderNumber" DESC, "createdAt" DESC
  `
  return rows.map((row) => ({
    ...row,
    receivedAt: row.receivedAt?.toISOString() || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}