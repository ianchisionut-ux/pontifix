import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'
import { normalizeOfferSheet, offerTotals } from '@/lib/offer-sheet'
import { offerEmailImageHtml } from '@/lib/offer-message'
import { getEmailTransport } from '@/lib/email-settings'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Contul are acces doar pentru vizualizare.' }, { status: 403 })
  const emailTransport = await getEmailTransport(access.businessId)
  if (!emailTransport) return NextResponse.json({ error: 'Yahoo Mail nu este configurat sau este dezactivat.' }, { status: 503 })
  await ensureQuoteStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "QuoteRequest" WHERE "id"=${id} AND ("businessId"=${access.businessId} OR "businessId" IS NULL) LIMIT 1`
  if (!rows[0]) return NextResponse.json({ error: 'Cererea nu există.' }, { status: 404 })
  const input = await request.json()
  const data = normalizeOfferSheet(input, rows[0], rows[0].atrOcrData)
  if (!data.customerEmail) return NextResponse.json({ error: 'Beneficiarul nu are adresă de e-mail.' }, { status: 400 })
  const offerImage = typeof input?.offerImage === 'string' ? input.offerImage : ''
  const match = offerImage.length <= 12_000_000 ? /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(offerImage) : null
  if (!match) return NextResponse.json({ error: 'Imaginea fișei lipsește sau este invalidă. Deschide fișa și încearcă din nou.' }, { status: 400 })
  const imageBuffer = Buffer.from(match[1], 'base64')
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (imageBuffer.length < 100 || imageBuffer.length > 8_000_000 || !imageBuffer.subarray(0, 8).equals(pngSignature)) {
    return NextResponse.json({ error: 'Imaginea fișei este invalidă sau prea mare.' }, { status: 400 })
  }

  try {
    const result = await emailTransport.transporter.sendMail({
      from: emailTransport.from,
      to: data.customerEmail,
      subject: `Oferta Elmont ${data.offerNumber} – ${data.serviceType}`,
      html: offerEmailImageHtml(data),
      text: `Bună ziua, ${data.customerName}! Vă transmitem oferta ${data.offerNumber} ca imagine atașată. Cu stimă, Elmont S.A.`,
      attachments: [{
        filename: `Oferta_${data.offerNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`,
        content: imageBuffer,
        contentType: 'image/png',
        contentDisposition: 'inline',
        cid: 'elmont-offer-sheet',
      }],
    })
    if (!result.accepted.length || result.rejected.length) {
      const rejected = result.rejected.map(String).join(', ')
      throw Object.assign(new Error(`Destinatar refuzat: ${rejected || data.customerEmail}`), { code: 'ERECIPIENT' })
    }
  } catch (error) {
    const smtpError = error as { code?: string; command?: string; responseCode?: number; message?: string }
    console.error('Yahoo offer delivery failed:', {
      code: smtpError.code,
      command: smtpError.command,
      responseCode: smtpError.responseCode,
      message: smtpError.message,
      recipient: data.customerEmail,
    })
    const code = smtpError.code || String(smtpError.responseCode || 'SMTP_ERROR')
    const message = code === 'EAUTH'
      ? 'Yahoo a respins autentificarea. Generează o parolă nouă pentru aplicație în Yahoo și salveaz-o din nou în Configurare.'
      : code === 'EENVELOPE' || code === 'ERECIPIENT' || smtpError.responseCode === 550 || smtpError.responseCode === 553
        ? 'Yahoo a refuzat adresa beneficiarului. Verifică adresa de e-mail din fișa ofertei.'
        : ['ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(code)
          ? 'Conexiunea securizată cu Yahoo a expirat. Încearcă din nou; dacă persistă, folosește Test e-mail din Configurare.'
          : 'Yahoo nu a acceptat mesajul. Verifică parola pentru aplicație și adresa beneficiarului.'
    return NextResponse.json({ error: message, diagnostic: code }, { status: 502 })
  }

  await prisma.$executeRaw`UPDATE "QuoteRequest" SET "offerData"=CAST(${JSON.stringify(data)} AS JSONB),
    "name"=${data.customerName.trim() || 'Beneficiar de completat'}, "phone"=${data.customerPhone},
    "email"=${data.customerEmail}, "location"=${data.workLocation || null},
    "serviceType"=${data.serviceType}, "estimatedValue"=${offerTotals(data).net},
    "status"='QUOTED', "offerSentAt"=CURRENT_TIMESTAMP, "offerEmailSentAt"=CURRENT_TIMESTAMP,
    "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}`
  return NextResponse.json({ sent: true, attachments: 1, offerData: data })
}
