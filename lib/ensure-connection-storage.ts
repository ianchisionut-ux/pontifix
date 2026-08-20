import { prisma } from '@/lib/prisma'

let ready: Promise<void> | null = null

export function ensureConnectionStorage() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ConnectionCase" (
      "id" TEXT NOT NULL,
      "businessId" TEXT NOT NULL,
      "sequenceNumber" INTEGER,
      "nib" TEXT,
      "status" TEXT NOT NULL DEFAULT 'DOSAR_APROBAT',
      "quoteRequestId" TEXT,
      "deerSubmittedAt" DATE,
      "fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "atrPathname" TEXT,
      "atrName" TEXT,
      "createdByEmail" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConnectionCase_pkey" PRIMARY KEY ("id")
    )`).then(async () => {
      const columns = [`"sequenceNumber" INTEGER`, `"nib" TEXT`, `"status" TEXT NOT NULL DEFAULT 'DOSAR_APROBAT'`, `"quoteRequestId" TEXT`, `"deerSubmittedAt" DATE`]
      for (const column of columns) await prisma.$executeRawUnsafe(`ALTER TABLE "ConnectionCase" ADD COLUMN IF NOT EXISTS ${column}`)
      await prisma.$executeRawUnsafe(`WITH ranked AS (
        SELECT "id", EXTRACT(YEAR FROM "createdAt")::int AS year,
          ROW_NUMBER() OVER (PARTITION BY "businessId", EXTRACT(YEAR FROM "createdAt") ORDER BY "createdAt", "id")::int AS sequence
        FROM "ConnectionCase"
      ) UPDATE "ConnectionCase" AS item SET "sequenceNumber"=ranked.sequence,
        "nib"='NIB-' || ranked.year || '-' || LPAD(ranked.sequence::text, 4, '0')
        FROM ranked WHERE item."id"=ranked."id" AND (item."nib" IS NULL OR item."sequenceNumber" IS NULL)`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConnectionCase_businessId_updatedAt_idx" ON "ConnectionCase"("businessId", "updatedAt")`)
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ConnectionCase_nib_key" ON "ConnectionCase"("nib") WHERE "nib" IS NOT NULL`)
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ConnectionCase_quoteRequestId_key" ON "ConnectionCase"("quoteRequestId") WHERE "quoteRequestId" IS NOT NULL`)
    }).catch((error) => { ready = null; throw error })
  }
  return ready
}
