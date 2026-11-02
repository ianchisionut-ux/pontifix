import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractDeerDossierNumber } from '@/lib/deer-submission'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'

export type DeerBorderou = {
  id: string
  connectionId: string | null
  documentPathname: string
  documentName: string
  source: string
  sender: string | null
  subject: string | null
  dossierNumber: string | null
  beneficiary: string | null
  receivedAt: Date
}

let ready: Promise<void> | null = null
export function ensureDeerBorderouStorage() {
  if (!ready) ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DeerBorderou" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "connectionId" TEXT,
    "documentPathname" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sender" TEXT,
    "subject" TEXT,
    "dossierNumber" TEXT,
    "beneficiary" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeerBorderou_business_source_unique" UNIQUE ("businessId", "sourceKey")
  )`).then(() => undefined).catch((error) => { ready = null; throw error })
  return ready
}

export function normalizePerson(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

export function extractDeerEmailIdentity(text: string) {
  const dossierNumber = extractDeerDossierNumber(text)
  const afterNumber = dossierNumber ? text.slice(text.indexOf(dossierNumber) + dossierNumber.length) : ''
  const beneficiary = afterNumber.match(/^\s*[,;:–-]\s*([A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ\s-]{3,80})(?=\s*[,.;]|\s+achitat|\s+pentru|\s+este|$)/i)?.[1]?.trim() || ''
  return { dossierNumber, beneficiary }
}

type CaseMatch = { id: string; fields: Record<string, string>; deerSubmission: { dossierNumber?: string } | null }
export function matchDeerCase(cases: CaseMatch[], dossierNumber: string, beneficiary: string) {
  if (!/^\d{13}$/.test(dossierNumber) || !beneficiary) return null
  const name = normalizePerson(beneficiary)
  const matches = cases.filter((item) => {
    const number = extractDeerDossierNumber(item.deerSubmission?.dossierNumber || '') || extractDeerDossierNumber(item.fields.ATR || '')
    const caseName = normalizePerson(item.fields.Beneficiar || '')
    return number === dossierNumber && caseName === name
  })
  return matches.length === 1 ? matches[0].id : null
}

export async function findDeerCase(businessId: string, dossierNumber: string, beneficiary: string) {
  if (!dossierNumber || !beneficiary) return null
  await ensureConnectionStorage()
  const cases = await prisma.$queryRaw<CaseMatch[]>`
    SELECT "id", "fields", "deerSubmission" FROM "ConnectionCase" WHERE "businessId"=${businessId}
  `
  return matchDeerCase(cases, dossierNumber, beneficiary)
}

export async function listDeerBorderouri(businessId: string) {
  await ensureDeerBorderouStorage()
  return prisma.$queryRaw<DeerBorderou[]>`
    SELECT "id", "connectionId", "documentPathname", "documentName", "source", "sender", "subject", "dossierNumber", "beneficiary", "receivedAt"
    FROM "DeerBorderou" WHERE "businessId"=${businessId} ORDER BY "receivedAt" DESC, "createdAt" DESC
  `
}

export async function saveDeerBorderou(input: {
  businessId: string; connectionId: string | null; documentPathname: string; documentName: string
  source: 'EMAIL' | 'UPLOAD'; sourceKey?: string; sender?: string; subject?: string
  dossierNumber?: string; beneficiary?: string; receivedAt?: Date
}) {
  await ensureDeerBorderouStorage()
  const id = randomUUID()
  const sourceKey = input.sourceKey || `upload:${id}`
  const receivedAt = input.receivedAt || new Date()
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DeerBorderou" ("id", "businessId", "connectionId", "documentPathname", "documentName", "source", "sourceKey", "sender", "subject", "dossierNumber", "beneficiary", "receivedAt")
    VALUES (${id}, ${input.businessId}, ${input.connectionId}, ${input.documentPathname}, ${input.documentName}, ${input.source}, ${sourceKey}, ${input.sender || null}, ${input.subject || null}, ${input.dossierNumber || null}, ${input.beneficiary || null}, ${receivedAt})
    ON CONFLICT ("businessId", "sourceKey") DO NOTHING
  `)
  return id
}

export function emailAttachmentKey(messageId: string, filename: string, content: Buffer) {
  return createHash('sha256').update(messageId).update('\0').update(filename).update('\0').update(content).digest('hex')
}
