import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export type SonerieRole = 'director' | 'ionut'

const COOKIE_NAME = 'sonerie_session'
const SESSION_AGE = 180 * 24 * 60 * 60
let storageReady: Promise<void> | null = null

export function configured() {
  return Boolean(process.env.SONERIE_DIRECTOR_CODE && process.env.SONERIE_IONUT_CODE && process.env.AUTH_SECRET)
}

function signature(value: string) {
  return createHmac('sha256', process.env.AUTH_SECRET || '').update(value).digest('base64url')
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function roleForCode(code: string): SonerieRole | null {
  if (!configured()) return null
  if (safeEqual(code, process.env.SONERIE_DIRECTOR_CODE!)) return 'director'
  if (safeEqual(code, process.env.SONERIE_IONUT_CODE!)) return 'ionut'
  return null
}

export async function setSonerieSession(role: SonerieRole) {
  const value = `${role}.${Date.now() + SESSION_AGE * 1000}`
  ;(await cookies()).set(COOKIE_NAME, `${value}.${signature(value)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
    path: '/', maxAge: SESSION_AGE,
  })
}

export async function getSonerieRole(): Promise<SonerieRole | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token || !configured()) return null
  const [role, expires, sig] = token.split('.')
  if ((role !== 'director' && role !== 'ionut') || !expires || !sig || Number(expires) < Date.now()) return null
  const value = `${role}.${expires}`
  return safeEqual(sig, signature(value)) ? role : null
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

export function ensureSonerieStorage() {
  if (!storageReady) {
    storageReady = (async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SonerieCall" (
        "id" TEXT PRIMARY KEY, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3) NOT NULL, "acknowledgedAt" TIMESTAMP(3), "response" TEXT
      )`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "SonerieCall" ADD COLUMN IF NOT EXISTS "response" TEXT`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "SonerieCall" ADD COLUMN IF NOT EXISTS "pushStatus" TEXT`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "SonerieCall" ADD COLUMN IF NOT EXISTS "pushQueuedAt" TIMESTAMP(3)`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "SonerieCall" ADD COLUMN IF NOT EXISTS "pushReceivedAt" TIMESTAMP(3)`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SonerieCall_created_idx" ON "SonerieCall" ("createdAt" DESC)`)
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SoneriePushSubscription" (
        "endpoint" TEXT PRIMARY KEY, "recipient" TEXT NOT NULL,
        "subscription" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SoneriePushSubscription_recipient_idx" ON "SoneriePushSubscription" ("recipient")`)
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SoneriePresence" (
        "person" TEXT PRIMARY KEY, "available" BOOLEAN NOT NULL DEFAULT TRUE,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
    })().catch((error) => { storageReady = null; throw error })
  }
  return storageReady
}

export type SonerieCall = { id: string; createdAt: Date; expiresAt: Date; acknowledgedAt: Date | null; response: string | null; pushStatus: string | null; pushQueuedAt: Date | null; pushReceivedAt: Date | null }

export async function getIonutAvailability() {
  await ensureSonerieStorage()
  const rows = await prisma.$queryRaw<Array<{ available: boolean }>>`SELECT "available" FROM "SoneriePresence" WHERE "person"='ionut'`
  return rows[0]?.available ?? true
}

export async function latestCall() {
  await ensureSonerieStorage()
  const rows = await prisma.$queryRaw<SonerieCall[]>`
    SELECT "id", "createdAt", "expiresAt", "acknowledgedAt", "response", "pushStatus", "pushQueuedAt", "pushReceivedAt" FROM "SonerieCall"
    WHERE "createdAt" > CURRENT_TIMESTAMP - INTERVAL '1 day'
    ORDER BY "createdAt" DESC LIMIT 1`
  return rows[0] || null
}

export function callView(call: SonerieCall | null) {
  if (!call) return null
  return {
    id: call.id,
    createdAt: call.createdAt.toISOString(),
    acknowledgedAt: call.acknowledgedAt?.toISOString() || null,
    response: call.response === 'unavailable' ? 'unavailable' : call.acknowledgedAt ? 'accepted' : null,
    active: !call.acknowledgedAt && call.expiresAt.getTime() > Date.now(),
    pushStatus: call.pushStatus,
    pushQueuedAt: call.pushQueuedAt?.toISOString() || null,
    pushReceivedAt: call.pushReceivedAt?.toISOString() || null,
  }
}
