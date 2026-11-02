import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { getStoredEmailSettings } from '@/lib/email-settings'
import { emailAttachmentKey, ensureDeerBorderouStorage, extractDeerEmailIdentity, findDeerCase, saveDeerBorderou } from '@/lib/deer-borderou'

const DEER_SENDER = 'noreply_energieelectrica_mn@distributie-energie.ro'
const MAX_PDF_BYTES = 20 * 1024 * 1024

export async function syncDeerBorderouri(businessId: string) {
  const settings = await getStoredEmailSettings(businessId)
  if (!settings?.enabled || !settings.smtpPasswordEncrypted) throw new Error('Configurează mai întâi contul Yahoo în Setări → E-mail.')
  const password = decrypt(settings.smtpPasswordEncrypted).replace(/\s+/g, '')
  const client = new ImapFlow({
    host: 'imap.mail.yahoo.com', port: 993, secure: true,
    auth: { user: settings.fromEmail, pass: password }, logger: false,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
  })
  await ensureDeerBorderouStorage()
  const result = { scanned: 0, imported: 0, matched: 0, pending: 0 }
  try {
    await client.connect()
    await client.mailboxOpen('INBOX', { readOnly: true })
    const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
    const all = await client.search({ from: DEER_SENDER, since }, { uid: true })
    const uids = (Array.isArray(all) ? all : []).slice(-100)
    for (const uid of uids) {
      const message = await client.fetchOne(uid, { source: true, envelope: true, internalDate: true }, { uid: true })
      if (!message || !message.source) continue
      result.scanned++
      const mail = await simpleParser(message.source, { skipHtmlToText: false })
      const sender = mail.from?.value?.[0]?.address?.toLowerCase() || ''
      if (sender !== DEER_SENDER) continue
      const subject = mail.subject || ''
      const { dossierNumber, beneficiary } = extractDeerEmailIdentity(`${subject}\n${mail.text || ''}`)
      const connectionId = await findDeerCase(businessId, dossierNumber, beneficiary)
      for (const attachment of mail.attachments) {
        const filename = attachment.filename || ''
        if (!/borderou.*\.pdf$/i.test(filename)) continue
        const content = attachment.content
        if (!content || content.length < 100 || content.length > MAX_PDF_BYTES || content.subarray(0, 5).toString() !== '%PDF-') continue
        const sourceKey = emailAttachmentKey(mail.messageId || String(uid), filename, content)
        const exists = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "DeerBorderou" WHERE "businessId"=${businessId} AND "sourceKey"=${sourceKey} LIMIT 1
        `
        if (exists.length) continue
        const blob = await put(`formulare/deer/borderou/${sourceKey}.pdf`, content, { access: 'private', contentType: 'application/pdf', addRandomSuffix: false })
        await saveDeerBorderou({
          businessId, connectionId, documentPathname: blob.pathname, documentName: filename,
          source: 'EMAIL', sourceKey, sender, subject, dossierNumber, beneficiary,
          receivedAt: mail.date || (message.internalDate ? new Date(message.internalDate) : new Date()),
        })
        result.imported++
        if (connectionId) result.matched++
        else result.pending++
      }
    }
    return result
  } finally {
    try { await client.logout() } catch { client.close() }
  }
}
