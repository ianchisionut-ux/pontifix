import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { prisma } from './prisma'
import type { SigningDocument } from './deer-signing-bundle'

let ready: Promise<void> | null = null
export async function ensureDeerSigningStorage() {
  if (!ready) ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DeerSigningRequest" (
    "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "connectionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL UNIQUE, "beneficiaryName" TEXT NOT NULL, "nib" TEXT NOT NULL,
    "bundlePathname" TEXT NOT NULL, "bundleHash" TEXT NOT NULL, "signedPathname" TEXT,
    "signedHash" TEXT, "documents" JSONB NOT NULL, "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "acceptedName" TEXT,
    "declaration" TEXT, "readDocumentIds" JSONB, "signatureImage" BYTEA,
    "signerIp" TEXT, "signerUserAgent" TEXT
  )`).then(() => undefined).catch((error) => { ready = null; throw error })
  await ready
}

export function newSigningToken() { return randomBytes(32).toString('base64url') }
export function signingTokenHash(token: string) { return createHash('sha256').update(token).digest('hex') }
export function sha256(bytes: Uint8Array) { return createHash('sha256').update(bytes).digest('hex') }
export function newSigningId() { return randomUUID() }

export type SigningRequestRow = {
  id: string; businessId: string; connectionId: string; beneficiaryName: string; nib: string;
  bundlePathname: string; bundleHash: string; signedPathname: string | null; signedHash: string | null;
  documents: SigningDocument[]; createdAt: Date; expiresAt: Date; revokedAt: Date | null;
  completedAt: Date | null; acceptedName: string | null
}

export async function getSigningRequest(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null
  await ensureDeerSigningStorage()
  const rows = await prisma.$queryRaw<SigningRequestRow[]>`
    SELECT "id", "businessId", "connectionId", "beneficiaryName", "nib", "bundlePathname", "bundleHash",
      "signedPathname", "signedHash", "documents", "createdAt", "expiresAt", "revokedAt", "completedAt", "acceptedName"
    FROM "DeerSigningRequest" WHERE "tokenHash"=${signingTokenHash(token)} LIMIT 1`
  return rows[0] || null
}

export function requestAvailable(row: SigningRequestRow) { return !row.revokedAt && row.expiresAt > new Date() }
