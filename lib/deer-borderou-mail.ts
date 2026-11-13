import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { getStoredEmailSettings } from '@/lib/email-settings'
import { emailAttachmentKey, ensureDeerBorderouStorage, extractDeerEmailIdentity, findDeerCase, saveDeerBorderou } from '@/lib/deer-borderou'
import { deerDocumentKindFromName } from '@/lib/deer-borderou-shared'

const DEER_SENDERS = [
  'noreply_energieelectrica_mn@distributie-energie.ro',
  'noreply_energieelectrica_tn@distributie-energie.ro',
]
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
  const result: {
    scanned: number; imported: number; matched: number; pending: number; corrected: number
    newDocuments: Array<{ id: string; documentName: string; documentKind: string; beneficiary: string; dossierNumber: string; connectionId: string | null }>
  } = { scanned: 0, imported: 0, matched: 0, pending: 0, corrected: 0, newDocuments: [] }
  try {
    await client.connect()
    await client.mailboxOpen('INBOX', { readOnly: true })
    const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
    const uidGroups = []
    for (const sender of DEER_SENDERS) uidGroups.push(await client.search({ from: sender, since }, { uid: true }))
    const uids = [...new Set(uidGroups.flatMap((group) => Array.isArray(group) ? group : []))].sort((a, b) => a - b).slice(-100)
    for (const uid of uids) {
      const message = await client.fetchOne(uid, { source: true, envelope: true, internalDate: true }, { uid: true })
      if (!message || !message.source) continue
      result.scanned++
      const mail = await simpleParser(message.source, { skipHtmlToText: false })
      const sender = mail.from?.value?.[0]?.address?.toLowerCase() || ''
      if (!DEER_SENDERS.includes(sender)) continue
      const subject = mail.subject || ''
      const html = typeof mail.html === 'string' ? mail.html : ''
      const { dossierNumber, beneficiary } = extractDeerEmailIdentity(`${subject}\n${mail.text || ''}\n${html.replace(/<[^>]*>/g, ' ')}\n${html}`)
      const connectionId = await findDeerCase(businessId, dossierNumber, beneficiary)
      for (const attachment of mail.attachments) {
        const filename = attachment.filename || ''
        if (!/\.pdf$/i.test(filename)) continue
        const documentKind = deerDocumentKindFromName(filename) || 'OTHER'
        const content = attachment.content
        if (!content || content.length < 100 || content.length > MAX_PDF_BYTES || content.subarray(0, 5).toString() !== '%PDF-') continue
        const sourceKey = emailAttachmentKey(mail.messageId || String(uid), filename, content)
        const exists = await prisma.$queryRaw<Array<{ id: string; connectionId: string | null; documentKind: string }>>`
          SELECT "id", "connectionId", "documentKind" FROM "DeerBorderou" WHERE "businessId"=${businessId} AND "sourceKey"=${sourceKey} LIMIT 1
        `
        if (exists.length) {
          if (connectionId && (exists[0].connectionId !== connectionId || exists[0].documentKind !== documentKind)) {
            await prisma.$executeRaw`
              UPDATE "DeerBorderou" SET "connectionId"=${connectionId}, "documentKind"=${documentKind}, "dossierNumber"=${dossierNumber}, "beneficiary"=${beneficiary}, "notificationStatus"='PENDING'
              WHERE "id"=${exists[0].id} AND "businessId"=${businessId} AND "source"='EMAIL'
            `
            result.corrected++
          }
          continue
        }
        const id = await saveDeerBorderou({
          businessId, connectionId, documentKind, documentPathname: `db:${sourceKey}`, documentData: content, documentName: filename,
          source: 'EMAIL', sourceKey, sender, subject, dossierNumber, beneficiary,
          receivedAt: mail.date || (message.internalDate ? new Date(message.internalDate) : new Date()),
        })
        result.imported++
        result.newDocuments.push({ id, documentName: filename, documentKind, beneficiary, dossierNumber, connectionId })
        if (connectionId) result.matched++
        else result.pending++
      }
    }
    return result
  } finally {
    try { await client.logout() } catch { client.close() }
  }
}
