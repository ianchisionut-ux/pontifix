import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'

const ocrSchema = z.object({
  customerName: z.string().trim().max(160),
  customerPhone: z.string().trim().max(40),
  workAddress: z.string().trim().max(400),
  atrNumber: z.string().trim().max(80),
  atrDate: z.string().trim().max(40),
  confidence: z.number().min(0).max(1),
  source: z.enum(['PDF_TEXT', 'LOCAL_OCR']),
}).nullable().optional()

const schema = z.object({
  atrPathname: z.string().trim().min(1).max(1000),
  atrName: z.string().trim().min(1).max(255),
  atrOcr: ocrSchema,
})

export async function POST(request: NextRequest) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success || !parsed.data.atrPathname.startsWith('cereri-oferta/')) {
    return NextResponse.json({ error: 'Document ATR invalid.' }, { status: 400 })
  }

  await ensureQuoteStorage()
  const { atrOcr, atrPathname, atrName } = parsed.data
  const id = crypto.randomUUID()
  const name = atrOcr?.customerName || 'Beneficiar de identificat'
  const phone = atrOcr?.customerPhone || ''
  const location = atrOcr?.workAddress || null
  const atrOcrJson = atrOcr ? JSON.stringify(atrOcr) : null
  await prisma.$executeRaw`
    INSERT INTO "QuoteRequest" ("id", "name", "email", "phone", "serviceType", "location", "message", "atrPathname", "atrName", "businessId", "atrOcrData", "status")
    VALUES (${id}, ${name}, '', ${phone}, 'Branșament electric', ${location}, 'Cerere creată intern prin încărcarea ATR-ului.', ${atrPathname}, ${atrName}, ${access.businessId}, CAST(${atrOcrJson} AS JSONB), 'NEW')
  `
  return NextResponse.json({ success: true, id }, { status: 201 })
}
