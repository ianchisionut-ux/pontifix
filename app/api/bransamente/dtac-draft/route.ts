import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { getConnectionAccess } from '@/lib/connection-access'
import { getStoredEmailSettings } from '@/lib/email-settings'
import { decrypt } from '@/lib/crypto'

export const runtime = 'nodejs'

const draftSchema = z.object({
  to: z.string().trim().email().max(320),
  subject: z.string().trim().min(1).max(250),
  body: z.string().min(1).max(12_000),
  html: z.string().min(1).max(30_000),
})

export async function POST(request: NextRequest) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate crea schițe DTAC.' }, { status: 403 })
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== request.nextUrl.host) {
    return NextResponse.json({ error: 'Cerere nepermisă.' }, { status: 403 })
  }
  const parsed = draftSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Completează o adresă validă pentru primărie.' }, { status: 400 })

  const settings = await getStoredEmailSettings(access.businessId)
  if (!settings?.enabled || !settings.smtpPasswordEncrypted) {
    return NextResponse.json({ error: 'Configurează contul Yahoo în Setări → E-mail.' }, { status: 400 })
  }
  let password = ''
  try { password = decrypt(settings.smtpPasswordEncrypted).replace(/\s+/g, '') } catch { /* configuration error below */ }
  if (!password) return NextResponse.json({ error: 'Parola Yahoo configurată nu poate fi citită.' }, { status: 400 })

  const fromEmail = settings.fromEmail.trim().toLowerCase()
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' })
  const message = await transport.sendMail({
    from: { name: settings.fromName.trim() || 'Elmont S.A.', address: fromEmail },
    to: parsed.data.to,
    subject: parsed.data.subject,
    text: parsed.data.body,
    html: parsed.data.html,
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  if (!Buffer.isBuffer(message.message)) {
    return NextResponse.json({ error: 'Schița nu a putut fi generată.' }, { status: 500 })
  }
  const client = new ImapFlow({
    host: 'imap.mail.yahoo.com', port: 993, secure: true,
    auth: { user: fromEmail, pass: password }, logger: false,
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
  })
  try {
    await client.connect()
    const mailboxes = await client.list()
    const drafts = mailboxes.find((box) => box.specialUse === '\\Drafts')
    if (!drafts) throw new Error('Folderul Ciorne nu a fost găsit în contul Yahoo.')
    const saved = await client.append(drafts.path, message.message, ['\\Draft', '\\Seen'], new Date())
    if (!saved) throw new Error('Yahoo nu a confirmat salvarea schiței.')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Yahoo DTAC draft:', error)
    return NextResponse.json({ error: 'Schița nu a putut fi salvată în Yahoo. Verifică conexiunea Yahoo și încearcă din nou.' }, { status: 502 })
  } finally {
    await client.logout().catch(() => undefined)
  }
}
