import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import type { ConnectionFields } from '@/lib/connection-fields'

export async function createConnectionCase(input: {
  businessId: string
  fields: ConnectionFields
  atrPathname?: string | null
  atrName?: string | null
  createdByEmail?: string | null
  quoteRequestId?: string | null
}) {
  await ensureConnectionStorage()
  return prisma.$transaction(async (tx) => {
    if (input.quoteRequestId) {
      const existing = await tx.$queryRaw<Array<{ id: string; nib: string }>>`
        SELECT "id", "nib" FROM "ConnectionCase" WHERE "quoteRequestId"=${input.quoteRequestId} LIMIT 1
      `
      if (existing[0]) return { ...existing[0], created: false }
    }
    const year = new Date().getFullYear()
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`connection-nib:${input.businessId}:${year}`}))`
    const nextRows = await tx.$queryRaw<Array<{ next: number }>>`
      SELECT COALESCE(MAX("sequenceNumber"), 0)::int + 1 AS "next"
      FROM "ConnectionCase" WHERE "businessId"=${input.businessId} AND "nib" LIKE ${`NIB-${year}-%`}
    `
    const sequenceNumber = nextRows[0]?.next || 1
    const nib = `NIB-${year}-${String(sequenceNumber).padStart(4, '0')}`
    const id = crypto.randomUUID()
    await tx.$executeRaw`
      INSERT INTO "ConnectionCase" ("id", "businessId", "sequenceNumber", "nib", "status", "quoteRequestId", "fields", "atrPathname", "atrName", "createdByEmail")
      VALUES (${id}, ${input.businessId}, ${sequenceNumber}, ${nib}, 'DOSAR_APROBAT', ${input.quoteRequestId || null}, ${JSON.stringify(input.fields)}::jsonb, ${input.atrPathname || null}, ${input.atrName || null}, ${input.createdByEmail || null})
    `
    return { id, nib, created: true }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
