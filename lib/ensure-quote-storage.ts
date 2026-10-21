import { prisma } from '@/lib/prisma'

let ready: Promise<void> | null = null

export function ensureQuoteStorage() {
  if (!ready) {
    ready = (async () => {
      const [schema] = await prisma.$queryRaw<{ ready: boolean }[]>`
        SELECT to_regclass('"QuoteRequest"') IS NOT NULL
          AND (SELECT COUNT(*) FROM pg_attribute WHERE attrelid = to_regclass('"QuoteRequest"')
            AND attname IN ('businessId', 'internalNotes', 'estimatedValue', 'updatedAt', 'atrOcrData', 'offerData', 'offerSentAt', 'offerEmailSentAt', 'offerWhatsappSentAt')
            AND attnum > 0 AND NOT attisdropped) = 9
          AND to_regclass('"QuoteRequest_status_createdAt_idx"') IS NOT NULL
          AND to_regclass('"QuoteRequest_businessId_createdAt_idx"') IS NOT NULL AS "ready"
      `
      if (schema?.ready) return
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "QuoteRequest" (
      "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "phone" TEXT NOT NULL,
      "serviceType" TEXT NOT NULL, "location" TEXT, "message" TEXT, "atrPathname" TEXT, "atrName" TEXT,
      "businessId" TEXT, "internalNotes" TEXT, "estimatedValue" DOUBLE PRECISION,
      "atrOcrData" JSONB, "offerData" JSONB, "offerSentAt" TIMESTAMP(3),
      "offerEmailSentAt" TIMESTAMP(3), "offerWhatsappSentAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'NEW', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
    )`)
      const columns = [
        `"businessId" TEXT`, `"internalNotes" TEXT`, `"estimatedValue" DOUBLE PRECISION`,
        `"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`, `"atrOcrData" JSONB`,
        `"offerData" JSONB`, `"offerSentAt" TIMESTAMP(3)`, `"offerEmailSentAt" TIMESTAMP(3)`,
        `"offerWhatsappSentAt" TIMESTAMP(3)`,
      ]
      for (const column of columns) await prisma.$executeRawUnsafe(`ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS ${column}`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "QuoteRequest_status_createdAt_idx" ON "QuoteRequest"("status", "createdAt")`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "QuoteRequest_businessId_createdAt_idx" ON "QuoteRequest"("businessId", "createdAt")`)
    })().catch((error) => { ready = null; throw error })
  }
  return ready
}
