import { prisma } from '@/lib/prisma'

export type IdentityCardRecord = {
  id: string
  connectionCaseId: string | null
  fullName: string
  cnp: string
  series: string
  number: string
  domicile: string
  issuedBy: string
  validFrom: string
  validUntil: string
  createdAt: string
  updatedAt: string
}

let ready: Promise<void> | null = null

export async function ensureIdentityCardStorage() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "IdentityCardRecord" (
      "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "connectionCaseId" TEXT,
      "fullName" TEXT NOT NULL DEFAULT '', "cnp" TEXT NOT NULL DEFAULT '',
      "series" TEXT NOT NULL DEFAULT '', "number" TEXT NOT NULL DEFAULT '',
      "domicile" TEXT NOT NULL DEFAULT '', "issuedBy" TEXT NOT NULL DEFAULT '',
      "validFrom" TEXT NOT NULL DEFAULT '', "validUntil" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "IdentityCardRecord_pkey" PRIMARY KEY ("id")
    )`).then(async () => {
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IdentityCardRecord_businessId_createdAt_idx" ON "IdentityCardRecord"("businessId", "createdAt" DESC)`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IdentityCardRecord_connectionCaseId_idx" ON "IdentityCardRecord"("connectionCaseId")`)
    }).catch((error) => { ready = null; throw error })
  }
  await ready
}

export async function listIdentityCards(businessId: string): Promise<IdentityCardRecord[]> {
  await ensureIdentityCardStorage()
  const rows = await prisma.$queryRaw<Array<Omit<IdentityCardRecord, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }>>`
    SELECT "id", "connectionCaseId", "fullName", "cnp", "series", "number", "domicile", "issuedBy", "validFrom", "validUntil", "createdAt", "updatedAt"
    FROM "IdentityCardRecord" WHERE "businessId"=${businessId} ORDER BY "createdAt" DESC
  `
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))
}