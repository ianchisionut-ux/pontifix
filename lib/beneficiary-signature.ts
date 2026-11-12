import { prisma } from '@/lib/prisma'

let storageReady: Promise<void> | null = null

export async function ensureBeneficiarySignatureStorage() {
  if (!storageReady) {
    storageReady = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "BeneficiarySignature" (
      "businessId" TEXT NOT NULL,
      "connectionId" TEXT NOT NULL,
      "image" BYTEA NOT NULL,
      "capturedByEmail" TEXT,
      "consentConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BeneficiarySignature_pkey" PRIMARY KEY ("businessId", "connectionId")
    )`).then(() => undefined).catch((error) => { storageReady = null; throw error })
  }
  await storageReady
}

export async function getBeneficiarySignature(businessId: string, connectionId: string) {
  await ensureBeneficiarySignatureStorage()
  const rows = await prisma.$queryRaw<Array<{ image: Uint8Array; signedAt: Date }>>`
    SELECT "image", "signedAt" FROM "BeneficiarySignature"
    WHERE "businessId"=${businessId} AND "connectionId"=${connectionId} LIMIT 1`
  return rows[0] || null
}
