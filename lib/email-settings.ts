import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

let ready: Promise<void> | null = null

export type EmailSettings = {
  businessId: string
  smtpPasswordEncrypted: string | null
  fromName: string
  fromEmail: string
  notificationEmail: string | null
  enabled: boolean
}

export function ensureEmailStorage() {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "BusinessEmailSettings" (
        "businessId" TEXT NOT NULL,
        "smtpPasswordEncrypted" TEXT,
        "fromName" TEXT NOT NULL DEFAULT 'Elmont S.A.',
        "fromEmail" TEXT NOT NULL DEFAULT 'elmont_zalau@yahoo.com',
        "notificationEmail" TEXT,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BusinessEmailSettings_pkey" PRIMARY KEY ("businessId"),
        CONSTRAINT "BusinessEmailSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "BusinessEmailSettings" ADD COLUMN IF NOT EXISTS "smtpPasswordEncrypted" TEXT`)
    })().catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}

export async function getStoredEmailSettings(businessId: string): Promise<EmailSettings | null> {
  await ensureEmailStorage()
  const rows = await prisma.$queryRaw<EmailSettings[]>`
    SELECT "businessId", "smtpPasswordEncrypted", "fromName", "fromEmail", "notificationEmail", "enabled"
    FROM "BusinessEmailSettings" WHERE "businessId" = ${businessId} LIMIT 1
  `
  return rows[0] ?? null
}

export async function getEmailTransport(businessId?: string | null) {
  const stored = businessId ? await getStoredEmailSettings(businessId) : null
  if (!stored || !stored.enabled || !stored.smtpPasswordEncrypted) return null

  let password = ''
  try { password = decrypt(stored.smtpPasswordEncrypted).replace(/\s+/g, '') } catch { return null }
  if (!password) return null

  const fromEmail = stored.fromEmail.trim().toLowerCase()
  const fromName = stored.fromName.trim() || 'Elmont S.A.'
  return {
    transporter: nodemailer.createTransport({
      host: 'smtp.mail.yahoo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      auth: { user: fromEmail, pass: password },
    }),
    from: { name: fromName, address: fromEmail },
    notificationEmail: stored.notificationEmail || null,
  }
}

export async function sendBusinessEmail(businessId: string | null | undefined, message: {
  to: string
  subject: string
  html: string
}) {
  const transport = await getEmailTransport(businessId)
  if (!transport) throw new Error('Yahoo Mail nu este configurat sau este dezactivat.')
  return transport.transporter.sendMail({ from: transport.from, ...message })
}
