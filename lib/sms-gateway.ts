import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export const SMS_SENDER_NUMBER = '+40727700062'
const SMS_API = 'https://api.sms-gate.app/3rdparty/v1'

export type SmsGatewayConfig = {
  businessId: string
  username: string
  password: string
  deviceId: string
  simNumber: number
  enabled: boolean
}

export type SmsDevice = { id: string; name?: string; lastSeen?: string; state?: string }

let storageReady: Promise<void> | null = null

export function ensureSmsStorage() {
  if (!storageReady) storageReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SmsGatewayConfig" (
      "businessId" TEXT PRIMARY KEY,
      "username" TEXT NOT NULL,
      "password" TEXT NOT NULL,
      "deviceId" TEXT NOT NULL DEFAULT '',
      "simNumber" INTEGER NOT NULL DEFAULT 1,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
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
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SmsOutbound_businessId_createdAt_idx" ON "SmsOutbound" ("businessId", "createdAt" DESC)`)
  })().catch((error) => { storageReady = null; throw error })
  return storageReady
}

export async function getSmsGatewayConfig(businessId: string) {
  await ensureSmsStorage()
  const rows = await prisma.$queryRaw<SmsGatewayConfig[]>`
    SELECT "businessId", "username", "password", "deviceId", "simNumber", "enabled"
    FROM "SmsGatewayConfig" WHERE "businessId"=${businessId} LIMIT 1
  `
  return rows[0] || null
}

export function normalizeRomanianMobile(value: string) {
  const compact = value.replace(/[\s().-]/g, '')
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact.startsWith('0') ? `+40${compact.slice(1)}` : compact
  return /^\+407\d{8}$/.test(international) ? international : null
}

async function gatewayRequest(config: Pick<SmsGatewayConfig, 'username' | 'password'>, path: string, init?: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${SMS_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.username}:${decrypt(config.password)}`).toString('base64')}`,
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(`Gateway SMS: ${response.status}${body?.message ? ` · ${String(body.message).slice(0, 160)}` : ''}`)
    return body
  } finally { clearTimeout(timer) }
}

export async function listSmsDevices(config: Pick<SmsGatewayConfig, 'username' | 'password'>): Promise<SmsDevice[]> {
  const body = await gatewayRequest(config, '/devices')
  return Array.isArray(body) ? body.filter((device) => typeof device?.id === 'string').map((device) => ({
    id: device.id,
    name: typeof device.name === 'string' ? device.name : undefined,
    lastSeen: typeof device.lastSeen === 'string' ? device.lastSeen : undefined,
    state: typeof device.state === 'string' ? device.state : undefined,
  })) : []
}

export async function queueSms(config: SmsGatewayConfig, id: string, recipient: string, message: string): Promise<{ id: string; state: string }> {
  const body = await gatewayRequest(config, '/messages', {
    method: 'POST',
    body: JSON.stringify({ id, deviceId: config.deviceId, simNumber: config.simNumber, phoneNumbers: [recipient], textMessage: { text: message }, ttl: 3600 }),
  })
  if (typeof body?.id !== 'string') throw new Error('Gateway-ul nu a returnat un ID de mesaj. Verifică istoricul înainte de a reîncerca.')
  return { id: body.id, state: typeof body.state === 'string' ? body.state : 'Pending' }
}

export async function getSmsState(config: SmsGatewayConfig, gatewayId: string): Promise<string> {
  const body = await gatewayRequest(config, `/messages/${encodeURIComponent(gatewayId)}`)
  if (typeof body?.state !== 'string') throw new Error('Starea SMS nu este disponibilă.')
  return body.state
}
