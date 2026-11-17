import { NextRequest, NextResponse } from 'next/server'
import { head } from '@vercel/blob'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const atrOcrSchema = z.object({
  customerName: z.string().trim().max(160), customerPhone: z.string().trim().max(40),
  workAddress: z.string().trim().max(400),
  customerId: z.string().trim().max(40).optional(),
  customerAddress: z.string().trim().max(500).optional(),
  pta: z.string().trim().max(300).optional(),
  solution: z.string().trim().max(4000).optional(), atrNumber: z.string().trim().max(80), atrDate: z.string().trim().max(40),
  confidence: z.number().min(0).max(1), source: z.enum(['PDF_TEXT', 'LOCAL_OCR']),
}).nullable().optional()

const quoteSchema = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(180).or(z.literal('')), phone: z.string().trim().min(7).max(30),
  serviceType: z.string().trim().min(2).max(100), location: z.string().trim().max(180).optional().or(z.literal('')),
  message: z.string().trim().max(2000).optional().or(z.literal('')), atrPathname: z.string().trim().max(1000).optional().or(z.literal('')),
  atrName: z.string().trim().max(255).optional().or(z.literal('')), atrOcr: atrOcrSchema, consent: z.literal(true),
})

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(`quote-request:${ip}`, 4, 60 * 60 * 1000).allowed) return NextResponse.json({ error: 'Ai trimis prea multe cereri. Încearcă din nou mai târziu.' }, { status: 429 })
  const parsed = quoteSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Verifică datele introduse și încearcă din nou.' }, { status: 400 })
  const data = parsed.data
  if (!data.message && !data.atrPathname) return NextResponse.json({ error: 'Completează detaliile despre proiect sau încarcă ATR-ul.' }, { status: 400 })
  if (data.atrPathname && !data.atrPathname.startsWith('cereri-oferta/')) return NextResponse.json({ error: 'Document ATR invalid.' }, { status: 400 })
  if (data.atrPathname) {
    const uploaded = await head(data.atrPathname).catch(() => null)
    if (!uploaded || uploaded.contentType !== 'application/pdf' || uploaded.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'ATR-ul încărcat nu este un PDF valid.' }, { status: 400 })
    }
  }

  await ensureQuoteStorage()
  const id = crypto.randomUUID()
  const elmontBusiness = await prisma.business.findFirst({ where: { name: { contains: 'Elmont', mode: 'insensitive' } }, select: { id: true } })
  const atrOcrJson = data.atrOcr ? JSON.stringify(data.atrOcr) : null
  await prisma.$executeRaw`
    INSERT INTO "QuoteRequest" ("id", "name", "email", "phone", "serviceType", "location", "message", "atrPathname", "atrName", "businessId", "atrOcrData")
    VALUES (${id}, ${data.name}, ${data.email.toLowerCase()}, ${data.phone}, ${data.serviceType}, ${data.location || null}, ${data.message || null}, ${data.atrPathname || null}, ${data.atrName || null}, ${elmontBusiness?.id || null}, CAST(${atrOcrJson} AS JSONB))
  `

  return NextResponse.json({ success: true, id }, { status: 201 })
}
