import { prisma } from '@/lib/prisma'

let ready: Promise<void> | null = null

export function ensureConnectionStorage() {
  if (!ready) {
    ready = (async () => {
      const [schema] = await prisma.$queryRaw<{ ready: boolean }[]>`
        SELECT to_regclass('"ConnectionCase"') IS NOT NULL
          AND (SELECT COUNT(*) FROM pg_attribute WHERE attrelid = to_regclass('"ConnectionCase"')
            AND attname IN ('sequenceNumber', 'nib', 'status', 'quoteRequestId', 'deerSubmittedAt', 'deerSubmission')
            AND attnum > 0 AND NOT attisdropped) = 6
          AND to_regclass('"ConnectionCase_businessId_updatedAt_idx"') IS NOT NULL
          AND to_regclass('"ConnectionCase_nib_key"') IS NOT NULL
          AND to_regclass('"ConnectionCase_quoteRequestId_key"') IS NOT NULL
          AND to_regclass('"MunicipalityEmail"') IS NOT NULL
          AND to_regclass('"MunicipalityEmail_businessId_email_key"') IS NOT NULL AS "ready"
      `
      if (schema?.ready) {
        const [missing] = await prisma.$queryRaw<{ exists: boolean }[]>`
          SELECT EXISTS(SELECT 1 FROM "ConnectionCase" WHERE "nib" IS NULL OR "sequenceNumber" IS NULL) AS "exists"
        `
        if (!missing?.exists) return
      }
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ConnectionCase" (
      "id" TEXT NOT NULL,
      "businessId" TEXT NOT NULL,
      "sequenceNumber" INTEGER,
      "nib" TEXT,
      "status" TEXT NOT NULL DEFAULT 'DOSAR_APROBAT',
      "quoteRequestId" TEXT,
      "deerSubmittedAt" DATE,
      "deerSubmission" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "atrPathname" TEXT,
      "atrName" TEXT,
      "createdByEmail" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConnectionCase_pkey" PRIMARY KEY ("id")
    )`)
      const columns = [`"sequenceNumber" INTEGER`, `"nib" TEXT`, `"status" TEXT NOT NULL DEFAULT 'DOSAR_APROBAT'`, `"quoteRequestId" TEXT`, `"deerSubmittedAt" DATE`, `"deerSubmission" JSONB NOT NULL DEFAULT '{}'::jsonb`]
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
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MunicipalityEmail" (
        "id" TEXT NOT NULL,
        "businessId" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MunicipalityEmail_pkey" PRIMARY KEY ("id")
      )`)
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MunicipalityEmail_businessId_email_key" ON "MunicipalityEmail"("businessId", "email")`)
    })().catch((error) => { ready = null; throw error })
  }
  return ready
}
