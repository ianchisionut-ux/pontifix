import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureQuoteStorage()
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count" FROM "QuoteRequest"
    WHERE "status" = 'NEW' AND ("businessId" = ${businessId} OR "businessId" IS NULL)
  `
  return NextResponse.json({ needsOperatorCount: 0, unseenConfirmationsCount: 0, newOffersCount: Number(rows[0]?.count || 0) })
}
