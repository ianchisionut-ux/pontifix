import { NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureQuoteStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ atrPathname: string | null; atrName: string | null }>>`
    SELECT "atrPathname", "atrName" FROM "QuoteRequest"
    WHERE "id" = ${id} AND ("businessId" = ${access.businessId} OR "businessId" IS NULL) LIMIT 1
  `
  const offer = rows[0]
  if (!offer?.atrPathname) return NextResponse.json({ error: 'ATR inexistent.' }, { status: 404 })
  const result = await get(offer.atrPathname, { access: 'private' })
  if (!result?.stream) return NextResponse.json({ error: 'Fișier indisponibil.' }, { status: 404 })
  const filename = (offer.atrName || 'ATR.pdf').replace(/["\r\n]/g, '')
  return new Response(result.stream, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` } })
}
