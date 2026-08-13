import { prisma } from '@/lib/prisma'

let ready: Promise<void> | null = null

export function ensureQuoteStorage() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "QuoteRequest" (
      "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "phone" TEXT NOT NULL,
      "serviceType" TEXT NOT NULL, "location" TEXT, "message" TEXT, "atrPathname" TEXT, "atrName" TEXT,
      "businessId" TEXT, "internalNotes" TEXT, "estimatedValue" DOUBLE PRECISION,
      "atrOcrData" JSONB, "offerData" JSONB, "offerSentAt" TIMESTAMP(3),
      "offerEmailSentAt" TIMESTAMP(3), "offerWhatsappSentAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'NEW', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
    )`).then(async () => {
      const columns = [
        `"businessId" TEXT`, `"internalNotes" TEXT`, `"estimatedValue" DOUBLE PRECISION`,
        `"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`, `"atrOcrData" JSONB`,
        `"offerData" JSONB`, `"offerSentAt" TIMESTAMP(3)`, `"offerEmailSentAt" TIMESTAMP(3)`,
        `"offerWhatsappSentAt" TIMESTAMP(3)`,
      ]
      for (const column of columns) await prisma.$executeRawUnsafe(`ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS ${column}`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "QuoteRequest_status_createdAt_idx" ON "QuoteRequest"("status", "createdAt")`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "QuoteRequest_businessId_createdAt_idx" ON "QuoteRequest"("businessId", "createdAt")`)
    }).catch((error) => { ready = null; throw error })
  }
  return ready
}
