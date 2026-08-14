import { prisma } from '@/lib/prisma'

let ready: Promise<void> | null = null

export function ensureConnectionStorage() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ConnectionCase" (
      "id" TEXT NOT NULL,
      "businessId" TEXT NOT NULL,
      "fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "atrPathname" TEXT,
      "atrName" TEXT,
      "createdByEmail" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConnectionCase_pkey" PRIMARY KEY ("id")
    )`).then(async () => {
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConnectionCase_businessId_updatedAt_idx" ON "ConnectionCase"("businessId", "updatedAt")`)
    }).catch((error) => { ready = null; throw error })
  }
  return ready
}
