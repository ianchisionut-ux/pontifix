import { prisma } from '@/lib/prisma'

let storageReady: Promise<void> | null = null

export async function ensureProjectBeneficiarySignatureStorage() {
  if (!storageReady) {
    storageReady = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ProjectBeneficiarySignature" (
      "businessId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "image" BYTEA NOT NULL,
      "capturedByEmail" TEXT,
      "consentConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProjectBeneficiarySignature_pkey" PRIMARY KEY ("businessId", "projectId"),
      CONSTRAINT "ProjectBeneficiarySignature_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
    )`).then(() => undefined).catch((error) => { storageReady = null; throw error })
  }
  await storageReady
}

export async function getProjectBeneficiarySignature(businessId: string, projectId: string) {
  await ensureProjectBeneficiarySignatureStorage()
  const rows = await prisma.$queryRaw<Array<{ image: Uint8Array; signedAt: Date }>>`
    SELECT "image", "signedAt" FROM "ProjectBeneficiarySignature"
    WHERE "businessId"=${businessId} AND "projectId"=${projectId} LIMIT 1`
  return rows[0] || null
}
