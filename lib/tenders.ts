import { prisma } from '@/lib/prisma'

export type Tender = {
  id: string
  title: string
  noticeNumber: string | null
  contractingAuthority: string | null
  procedureType: string | null
  cpvCode: string | null
  publicationDate: string | null
  deadline: string
  estimatedValue: number | null
  currency: string
  status: string
  seapUrl: string | null
  notes: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
}

type TenderRow = Omit<Tender, 'estimatedValue' | 'createdAt' | 'updatedAt'> & {
  estimatedValue: number | null
  createdAt: Date
  updatedAt: Date
}

let ready: Promise<void> | null = null

export function ensureTenderStorage() {
  if (!ready) ready = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Tender" (
      "id" TEXT PRIMARY KEY,
      "businessId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "noticeNumber" TEXT,
      "contractingAuthority" TEXT,
      "procedureType" TEXT,
      "cpvCode" TEXT,
      "publicationDate" TEXT,
      "deadline" TEXT NOT NULL,
      "estimatedValue" DOUBLE PRECISION,
      "currency" TEXT NOT NULL DEFAULT 'RON',
      "status" TEXT NOT NULL DEFAULT 'NESELECTATA',
      "seapUrl" TEXT,
      "notes" TEXT,
      "projectId" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await prisma.$executeRawUnsafe('ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "projectId" TEXT')
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Tender_business_deadline_idx" ON "Tender" ("businessId", "deadline")')
  })().catch(error => { ready = null; throw error })
  return ready
}

export async function listTenders(businessId: string): Promise<Tender[]> {
  await ensureTenderStorage()
  const rows = await prisma.$queryRaw<TenderRow[]>`
    SELECT "id", "title", "noticeNumber", "contractingAuthority", "procedureType", "cpvCode",
      "publicationDate", "deadline", "estimatedValue", "currency", "status", "seapUrl",
      "notes", "projectId", "createdAt", "updatedAt"
    FROM "Tender" WHERE "businessId" = ${businessId}
    ORDER BY "deadline" ASC, "createdAt" DESC
  `
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))
}
