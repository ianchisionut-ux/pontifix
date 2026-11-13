import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureDeerBorderouStorage } from '@/lib/deer-borderou'
import { getEmailTransport } from '@/lib/email-settings'
import { DEER_DOCUMENT_LABELS, type DeerDocumentKind } from '@/lib/deer-borderou-shared'

type PendingDocument = {
  id: string
  connectionId: string | null
  documentKind: DeerDocumentKind
  documentName: string
  beneficiary: string | null
  dossierNumber: string | null
  nib: string | null
  caseBeneficiary: string | null
  receivedAt: Date
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character] || character)

export async function notifyNewDeerDocuments(businessId: string) {
  await ensureDeerBorderouStorage()
  const documents = await prisma.$queryRaw<PendingDocument[]>`
    SELECT d."id", d."connectionId", d."documentKind", d."documentName", d."beneficiary", d."dossierNumber", d."receivedAt",
      c."nib", c."fields"->>'Beneficiar' AS "caseBeneficiary"
    FROM "DeerBorderou" d
    LEFT JOIN "ConnectionCase" c ON c."id"=d."connectionId" AND c."businessId"=d."businessId"
    WHERE d."businessId"=${businessId} AND d."source"='EMAIL' AND d."notificationStatus"='PENDING'
    ORDER BY d."createdAt" ASC LIMIT 100
  `
  if (!documents.length) return { notified: 0, pending: 0 }

  const transport = await getEmailTransport(businessId)
  const recipient = transport?.notificationEmail || process.env.ADMIN_NOTIFICATION_EMAIL
  if (!transport || !recipient) return { notified: 0, pending: documents.length, warning: 'Configurează adresa de notificări în Configurare → E-mail.' }

  const siteUrl = (process.env.APP_URL || 'https://elmont.ro').replace(/\/$/, '')
  const lines = documents.map((document) => {
    const kind = DEER_DOCUMENT_LABELS[document.documentKind] || document.documentKind
    const beneficiary = document.caseBeneficiary || document.beneficiary || 'Beneficiar neidentificat'
    const dossier = document.nib || (document.dossierNumber ? `ATR ${document.dossierNumber}` : 'dosar neidentificat')
    const association = document.nib ? `${beneficiary} · ${dossier}` : `${beneficiary} · ${dossier} · necesită asociere manuală`
    const received = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bucharest' }).format(document.receivedAt)
    const link = `${siteUrl}/dashboard/formulare?tab=DEER${document.connectionId ? `&case=${encodeURIComponent(document.connectionId)}` : ''}`
    return { kind, name: document.documentName, association, received, link }
  })
  const subject = `Elmont · ${documents.length} documente DEER noi`
  const text = [subject, '', ...lines.flatMap((line, index) => [
    `${index + 1}. ${line.kind} — ${line.name}`,
    `   Dosar: ${line.association}`,
    `   Primit: ${line.received}`,
    `   Deschide: ${line.link}`,
  ]), '', `Deschide Formulare / DEER: ${siteUrl}/dashboard/formulare?tab=DEER`].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;color:#082b4d"><h2>${escapeHtml(subject)}</h2><p>Documentele primite de la DEER și dosarele în care au fost puse:</p><ol>${lines.map((line) => `<li style="margin:0 0 14px"><strong>${escapeHtml(line.kind)}</strong> — ${escapeHtml(line.name)}<br><span>${escapeHtml(line.association)}</span><br><small>Primit: ${escapeHtml(line.received)}</small><br><a href="${escapeHtml(line.link)}">Deschide dosarul</a></li>`).join('')}</ol><p><a href="${escapeHtml(siteUrl)}/dashboard/formulare?tab=DEER">Deschide Formulare / DEER</a></p></div>`
  await transport.transporter.sendMail({ from: transport.from, to: recipient, subject, text, html })
  const ids = documents.map((document) => document.id)
  await prisma.$executeRaw`
    UPDATE "DeerBorderou" SET "notificationStatus"='SENT'
    WHERE "businessId"=${businessId} AND "id" IN (${Prisma.join(ids)}) AND "notificationStatus"='PENDING'
  `
  return { notified: documents.length, pending: 0 }
}
