import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

let ready: Promise<void> | null = null

export type EmailSettings = {
  businessId: string
  apiKeyEncrypted: string | null
  fromName: string
  fromEmail: string
  notificationEmail: string | null
  enabled: boolean
}

export function ensureEmailStorage() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "BusinessEmailSettings" (
      "businessId" TEXT NOT NULL,
      "apiKeyEncrypted" TEXT,
      "fromName" TEXT NOT NULL DEFAULT 'Elmont S.A.',
      "fromEmail" TEXT NOT NULL DEFAULT 'onboarding@resend.dev',
      "notificationEmail" TEXT,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BusinessEmailSettings_pkey" PRIMARY KEY ("businessId"),
      CONSTRAINT "BusinessEmailSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`).then(() => undefined).catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}

export async function getStoredEmailSettings(businessId: string): Promise<EmailSettings | null> {
  await ensureEmailStorage()
  const rows = await prisma.$queryRaw<EmailSettings[]>`
    SELECT "businessId", "apiKeyEncrypted", "fromName", "fromEmail", "notificationEmail", "enabled"
    FROM "BusinessEmailSettings" WHERE "businessId" = ${businessId} LIMIT 1
  `
  return rows[0] ?? null
}

export async function getEmailTransport(businessId?: string | null) {
  const stored = businessId ? await getStoredEmailSettings(businessId) : null
  if (stored && !stored.enabled) return null

  let apiKey = process.env.RESEND_API_KEY || ''
  if (stored?.apiKeyEncrypted) {
    try { apiKey = decrypt(stored.apiKeyEncrypted) } catch { apiKey = '' }
  }
  if (!apiKey) return null

  const fromName = stored?.fromName || 'Elmont S.A.'
  const fromEmail = stored?.fromEmail || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  return {
    apiKey,
    from: `${fromName} <${fromEmail}>`,
    notificationEmail: stored?.notificationEmail || process.env.ADMIN_NOTIFICATION_EMAIL || null,
  }
}
