import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'
import { normalizeOfferSheet } from '@/lib/offer-sheet'
import { offerEmailHtml } from '@/lib/offer-message'
import { getEmailTransport } from '@/lib/email-settings'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const emailTransport = await getEmailTransport(access.businessId)
  if (!emailTransport) return NextResponse.json({ error: 'Serviciul de e-mail nu este configurat sau este dezactivat.' }, { status: 503 })
  await ensureQuoteStorage(); const { id } = await params
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "QuoteRequest" WHERE "id"=${id} AND ("businessId"=${access.businessId} OR "businessId" IS NULL) LIMIT 1`
  if (!rows[0]) return NextResponse.json({ error: 'Cererea nu există.' }, { status: 404 })
  const data = normalizeOfferSheet(await request.json(), rows[0], rows[0].atrOcrData)
  if (!data.customerEmail) return NextResponse.json({ error: 'Beneficiarul nu are adresă de e-mail.' }, { status: 400 })
  const resend = new Resend(emailTransport.apiKey)
  const sent = await resend.emails.send({ from: emailTransport.from, to: data.customerEmail, subject: `Oferta Elmont ${data.offerNumber} – ${data.serviceType}`, html: offerEmailHtml(data) })
  if (sent.error) return NextResponse.json({ error: sent.error.message }, { status: 502 })
  await prisma.$executeRaw`UPDATE "QuoteRequest" SET "offerData"=CAST(${JSON.stringify(data)} AS JSONB), "status"='QUOTED', "offerSentAt"=CURRENT_TIMESTAMP, "offerEmailSentAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}`
  return NextResponse.json({ sent: true })
}

