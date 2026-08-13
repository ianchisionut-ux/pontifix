import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { ensureWhatsAppStorage } from '@/lib/ensure-whatsapp-storage'
import { getOfferAccess } from '@/lib/offer-access'
import { normalizeOfferSheet } from '@/lib/offer-sheet'
import { offerText } from '@/lib/offer-message'
import { sendProjectWhatsApp, whatsappFallbackUrl } from '@/lib/project-whatsapp'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureQuoteStorage(); const { id } = await params
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "QuoteRequest" WHERE "id"=${id} AND ("businessId"=${access.businessId} OR "businessId" IS NULL) LIMIT 1`
  if (!rows[0]) return NextResponse.json({ error: 'Cererea nu există.' }, { status: 404 })
  const data = normalizeOfferSheet(await request.json(), rows[0], rows[0].atrOcrData)
  if (!data.customerPhone) return NextResponse.json({ error: 'Beneficiarul nu are telefon.' }, { status: 400 })
  const message = offerText(data); const fallbackUrl = whatsappFallbackUrl(data.customerPhone, message)
  await prisma.$executeRaw`UPDATE "QuoteRequest" SET "offerData"=CAST(${JSON.stringify(data)} AS JSONB), "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}`
  await ensureWhatsAppStorage()
  const channel = await prisma.channel.findFirst({ where: { businessId: access.businessId, type: 'WHATSAPP', status: 'ACTIVE', enabledByOwner: true }, select: { id: true } })
  if (!channel) return NextResponse.json({ sent: false, fallbackUrl, message: 'WhatsApp Business nu este configurat. Se va deschide WhatsApp cu mesajul completat.' })
  try {
    await sendProjectWhatsApp(channel.id, data.customerPhone, message)
    await prisma.$executeRaw`UPDATE "QuoteRequest" SET "status"='QUOTED', "offerSentAt"=CURRENT_TIMESTAMP, "offerWhatsappSentAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}`
    return NextResponse.json({ sent: true })
  } catch (error) {
    return NextResponse.json({ sent: false, fallbackUrl, message: error instanceof Error ? error.message : 'Trimiterea directă nu a reușit.' })
  }
}
