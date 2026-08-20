import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { ensureMessageStorage } from '@/lib/ensure-message-storage'
import { ensureInternalChatStorage } from '@/lib/ensure-internal-chat-storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const userId = (session as any)?.userId as string | undefined
  if (!businessId || !userId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await Promise.all([ensureQuoteStorage(), ensureMessageStorage(), ensureInternalChatStorage()])
  const rows = await prisma.$queryRaw<Array<{ offers: bigint; messages: bigint; internal: bigint }>>`
    SELECT
      (SELECT COUNT(*) FROM "QuoteRequest" WHERE "status"='NEW' AND ("businessId"=${businessId} OR "businessId" IS NULL))::bigint AS "offers",
      (SELECT COUNT(*) FROM "CustomerMessage" WHERE "status"='NEW' AND ("businessId"=${businessId} OR "businessId" IS NULL))::bigint AS "messages",
      (SELECT COUNT(*) FROM "InternalChatReceipt" r JOIN "InternalChatMessage" m ON m."id"=r."messageId"
        WHERE r."userId"=${userId} AND r."readAt" IS NULL AND m."businessId"=${businessId})::bigint AS "internal"
  `
  return NextResponse.json({
    needsOperatorCount: Number(rows[0]?.messages || 0),
    unseenConfirmationsCount: 0,
    newOffersCount: Number(rows[0]?.offers || 0),
    internalChatCount: Number(rows[0]?.internal || 0),
  })
}
