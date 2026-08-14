import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { ensureEmailStorage, getStoredEmailSettings } from '@/lib/email-settings'

const schema = z.object({
  appPassword: z.string().trim().max(500).optional(),
  fromName: z.string().trim().min(2).max(100),
  fromEmail: z.string().trim().email().max(180).refine(
    (email) => email.toLowerCase().endsWith('@yahoo.com'),
    'Introdu o adresă Yahoo validă (@yahoo.com).',
  ),
  notificationEmail: z.string().trim().email().max(180),
  enabled: z.boolean(),
})

async function access() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const role = (session as any)?.role
  return businessId && role === 'SUPER_ADMIN' ? businessId : null
}

export async function GET() {
  const businessId = await access()
  if (!businessId) return NextResponse.json({ error: 'Doar Super Adminul poate configura e-mailul.' }, { status: 403 })
  const settings = await getStoredEmailSettings(businessId)
  return NextResponse.json({
    configured: !!settings?.smtpPasswordEncrypted,
    fromName: settings?.fromName || 'Elmont S.A.',
    fromEmail: settings?.fromEmail?.toLowerCase().endsWith('@yahoo.com') ? settings.fromEmail : 'elmont_zalau@yahoo.com',
    notificationEmail: settings?.notificationEmail || process.env.ADMIN_NOTIFICATION_EMAIL || '',
    enabled: settings?.enabled ?? true,
  })
}

export async function PUT(request: NextRequest) {
  const businessId = await access()
  if (!businessId) return NextResponse.json({ error: 'Doar Super Adminul poate configura e-mailul.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Date invalide.' }, { status: 400 })
  await ensureEmailStorage()
  const current = await getStoredEmailSettings(businessId)
  if (!current?.smtpPasswordEncrypted && !parsed.data.appPassword) {
    return NextResponse.json({ error: 'Parola Yahoo pentru aplicație este obligatorie la prima configurare.' }, { status: 400 })
  }

  const smtpPasswordEncrypted = parsed.data.appPassword
    ? encrypt(parsed.data.appPassword.replace(/\s+/g, ''))
    : current?.smtpPasswordEncrypted || null
  await prisma.$executeRaw`
    INSERT INTO "BusinessEmailSettings" ("businessId", "smtpPasswordEncrypted", "fromName", "fromEmail", "notificationEmail", "enabled", "updatedAt")
    VALUES (${businessId}, ${smtpPasswordEncrypted}, ${parsed.data.fromName}, ${parsed.data.fromEmail.toLowerCase()}, ${parsed.data.notificationEmail.toLowerCase()}, ${parsed.data.enabled}, CURRENT_TIMESTAMP)
    ON CONFLICT ("businessId") DO UPDATE SET
      "smtpPasswordEncrypted" = EXCLUDED."smtpPasswordEncrypted", "fromName" = EXCLUDED."fromName", "fromEmail" = EXCLUDED."fromEmail",
      "notificationEmail" = EXCLUDED."notificationEmail", "enabled" = EXCLUDED."enabled", "updatedAt" = CURRENT_TIMESTAMP
  `
  return NextResponse.json({ success: true, configured: !!smtpPasswordEncrypted })
}
