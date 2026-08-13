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
      "status" TEXT NOT NULL DEFAULT 'NEW',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
    )`).then(async () => {
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "QuoteRequest_status_createdAt_idx" ON "QuoteRequest"("status", "createdAt")`)
    }).catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}
