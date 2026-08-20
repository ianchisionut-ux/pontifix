import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'
import { normalizeOfferSheet } from '@/lib/offer-sheet'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Contul are acces doar pentru vizualizare.' }, { status: 403 })
  await ensureQuoteStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "QuoteRequest" WHERE "id"=${id} AND ("businessId"=${access.businessId} OR "businessId" IS NULL) LIMIT 1`
  if (!rows[0]) return NextResponse.json({ error: 'Cererea nu există.' }, { status: 404 })
  const offerData = normalizeOfferSheet(await request.json(), rows[0], rows[0].atrOcrData)
  await prisma.$executeRaw`UPDATE "QuoteRequest" SET "offerData"=CAST(${JSON.stringify(offerData)} AS JSONB), "estimatedValue"=${offerData.executionNet + offerData.projectNet + (offerData.panelIncluded ? offerData.panelNet : 0)}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}`
  revalidatePath('/dashboard/oferte')
  return NextResponse.json({ success: true, offerData })
}