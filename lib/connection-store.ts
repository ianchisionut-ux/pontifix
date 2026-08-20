import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import type { ConnectionFields } from '@/lib/connection-fields'

export function connectionIdentityFromContract(contractNumber: string, year = new Date().getFullYear()) {
  const match = contractNumber.trim().match(/\d+/)
  const sequenceNumber = match ? Number.parseInt(match[0], 10) : 0
  if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber < 1) {
    throw new Error('Completează un Număr contract valid înainte de salvare.')
  }
  return { sequenceNumber, nib: `NIB-${year}-${String(sequenceNumber).padStart(4, '0')}` }
}

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
    const { sequenceNumber, nib } = connectionIdentityFromContract(input.fields.NrContract, year)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`connection-nib:${input.businessId}:${year}`}))`
    const duplicate = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ConnectionCase" WHERE "businessId"=${input.businessId} AND "nib"=${nib} LIMIT 1
    `
    if (duplicate[0]) throw new Error(`Numărul de contract ${input.fields.NrContract} este deja folosit (${nib}).`)
    const id = crypto.randomUUID()
    await tx.$executeRaw`
      INSERT INTO "ConnectionCase" ("id", "businessId", "sequenceNumber", "nib", "status", "quoteRequestId", "fields", "atrPathname", "atrName", "createdByEmail")
      VALUES (${id}, ${input.businessId}, ${sequenceNumber}, ${nib}, 'DOSAR_APROBAT', ${input.quoteRequestId || null}, ${JSON.stringify(input.fields)}::jsonb, ${input.atrPathname || null}, ${input.atrName || null}, ${input.createdByEmail || null})
    `
    return { id, nib, created: true }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
