import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'
import { normalizeOfferSheet } from '@/lib/offer-sheet'
import { offerEmailHtml, offerText } from '@/lib/offer-message'
import { generateOfferPdf, offerPdfFilename } from '@/lib/offer-pdf'
import { getEmailTransport } from '@/lib/email-settings'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const emailTransport = await getEmailTransport(access.businessId)
  if (!emailTransport) return NextResponse.json({ error: 'Yahoo Mail nu este configurat sau este dezactivat.' }, { status: 503 })
  await ensureQuoteStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "QuoteRequest" WHERE "id"=${id} AND ("businessId"=${access.businessId} OR "businessId" IS NULL) LIMIT 1`
  if (!rows[0]) return NextResponse.json({ error: 'Cererea nu există.' }, { status: 404 })
  const data = normalizeOfferSheet(await request.json(), rows[0], rows[0].atrOcrData)
  if (!data.customerEmail) return NextResponse.json({ error: 'Beneficiarul nu are adresă de e-mail.' }, { status: 400 })

  try {
    const pdf = await generateOfferPdf(data)
    await emailTransport.transporter.sendMail({
      from: emailTransport.from,
      to: data.customerEmail,
      subject: `Oferta Elmont ${data.offerNumber} – ${data.serviceType}`,
      html: offerEmailHtml(data),
      text: offerText(data),
      attachments: [{
        filename: offerPdfFilename(data),
        content: pdf,
        contentType: 'application/pdf',
      }],
    })
  } catch (error) {
    console.error('Yahoo SMTP offer send failed:', error)
    return NextResponse.json({ error: 'Oferta și PDF-ul nu au putut fi trimise prin Yahoo Mail.' }, { status: 502 })
  }
  await prisma.$executeRaw`UPDATE "QuoteRequest" SET "offerData"=CAST(${JSON.stringify(data)} AS JSONB), "status"='QUOTED', "offerSentAt"=CURRENT_TIMESTAMP, "offerEmailSentAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}`
  return NextResponse.json({ sent: true, attachments: 1 })
}
