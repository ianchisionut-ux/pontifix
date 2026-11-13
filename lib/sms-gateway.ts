import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'

export const SMS_SENDER_NUMBER = '+40727700062'

export type SmsGatewayConfig = {
  businessId: string
  tokenHash: string
  enabled: boolean
  lastSeenAt: Date | null
}

let storageReady: Promise<void> | null = null

export function ensureSmsStorage() {
  if (!storageReady) storageReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SmsNativeDevice" (
      "businessId" TEXT PRIMARY KEY,
      "tokenHash" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "lastSeenAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SmsOutbound" (
      "id" TEXT PRIMARY KEY,
      "businessId" TEXT NOT NULL,
      "connectionId" TEXT NOT NULL,
      "nib" TEXT NOT NULL,
      "beneficiary" TEXT NOT NULL,
      "recipient" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "gatewayId" TEXT,
      "state" TEXT NOT NULL,
      "error" TEXT,
      "createdByEmail" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "SmsOutbound" ADD COLUMN IF NOT EXISTS "transport" TEXT NOT NULL DEFAULT 'cloud'`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SmsOutbound_businessId_createdAt_idx" ON "SmsOutbound" ("businessId", "createdAt" DESC)`)
  })().catch((error) => { storageReady = null; throw error })
  return storageReady
}

export async function getSmsGatewayConfig(businessId: string) {
  await ensureSmsStorage()
  const rows = await prisma.$queryRaw<SmsGatewayConfig[]>`
    SELECT "businessId", "tokenHash", "enabled", "lastSeenAt"
    FROM "SmsNativeDevice" WHERE "businessId"=${businessId} LIMIT 1
  `
  return rows[0] || null
}

export function normalizeRomanianMobile(value: string) {
  const compact = value.replace(/[\s().-]/g, '')
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact.startsWith('0') ? `+40${compact.slice(1)}` : compact
  return /^\+407\d{8}$/.test(international) ? international : null
}

export function createSmsDeviceToken(businessId: string) {
  const token = `${businessId}.${crypto.randomBytes(32).toString('base64url')}`
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') }
}

export async function authenticateSmsDevice(authorization: string | null) {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  const dot = token.indexOf('.')
  if (dot < 1 || token.length > 200) return null
  const businessId = token.slice(0, dot)
  const config = await getSmsGatewayConfig(businessId)
  if (!config?.enabled || !/^[0-9a-f]{64}$/.test(config.tokenHash)) return null
  const candidate = crypto.createHash('sha256').update(token).digest()
  const expected = Buffer.from(config.tokenHash, 'hex')
  return crypto.timingSafeEqual(candidate, expected) ? config : null
}
