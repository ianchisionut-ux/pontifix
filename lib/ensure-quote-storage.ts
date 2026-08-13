import { prisma } from '@/lib/prisma'

let ready: Promise<void> | null = null

export function ensureQuoteStorage() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "QuoteRequest" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "serviceType" TEXT NOT NULL,
      "location" TEXT,
      "message" TEXT,
      "atrPathname" TEXT,
      "atrName" TEXT,
      "businessId" TEXT,
      "internalNotes" TEXT,
      "estimatedValue" DOUBLE PRECISION,
      "status" TEXT NOT NULL DEFAULT 'NEW',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
    )`).then(async () => {
      await prisma.$executeRawUnsafe(`ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "businessId" TEXT`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "estimatedValue" DOUBLE PRECISION`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "QuoteRequest_status_createdAt_idx" ON "QuoteRequest"("status", "createdAt")`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "QuoteRequest_businessId_createdAt_idx" ON "QuoteRequest"("businessId", "createdAt")`)
    }).catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}
