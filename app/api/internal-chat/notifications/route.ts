import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureInternalChatStorage } from '@/lib/ensure-internal-chat-storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const userId = (session as any)?.userId as string | undefined
  if (!businessId || !userId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureInternalChatStorage()
  const sinceRaw = request.nextUrl.searchParams.get('since')
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw) : new Date()
  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count" FROM "InternalChatReceipt" r
    JOIN "InternalChatMessage" m ON m."id"=r."messageId"
    WHERE r."userId"=${userId} AND r."readAt" IS NULL AND m."businessId"=${businessId}
  `
  const items = await prisma.$queryRaw<Array<{ id:string; senderEmail:string; text:string; createdAt:Date }>>`
    SELECT m."id", u."email" AS "senderEmail", m."text", m."createdAt"
    FROM "InternalChatReceipt" r
    JOIN "InternalChatMessage" m ON m."id"=r."messageId"
    JOIN "User" u ON u."id"=m."senderId"
    WHERE r."userId"=${userId} AND r."readAt" IS NULL AND m."businessId"=${businessId} AND m."createdAt">${since}
    ORDER BY m."createdAt" ASC LIMIT 10
  `
  return NextResponse.json({ unreadCount: Number(countRows[0]?.count || 0), items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })), serverTime: new Date().toISOString() })
}