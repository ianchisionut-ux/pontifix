import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureInternalChatStorage } from '@/lib/ensure-internal-chat-storage'

export const dynamic = 'force-dynamic'

async function getAccess() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const userId = (session as any)?.userId as string | undefined
  return businessId && userId ? { businessId, userId } : null
}

export async function GET() {
  const access = await getAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureInternalChatStorage()
  const users = await prisma.$queryRaw<Array<{ id: string; email: string; role: string }>>`
    SELECT "id", "email", "role"::text AS "role" FROM "User"
    WHERE "businessId"=${access.businessId} ORDER BY "email" ASC
  `
  const messages = await prisma.$queryRaw<Array<{ id:string; senderId:string; senderEmail:string; recipientId:string|null; recipientEmail:string|null; text:string; createdAt:Date; isUnread:boolean }>>`
    SELECT q.*, (r."readAt" IS NULL AND r."userId" IS NOT NULL) AS "isUnread"
    FROM (
      SELECT m."id", m."senderId", s."email" AS "senderEmail", m."recipientId", u."email" AS "recipientEmail", m."text", m."createdAt"
      FROM "InternalChatMessage" m
      JOIN "User" s ON s."id"=m."senderId"
      LEFT JOIN "User" u ON u."id"=m."recipientId"
      WHERE m."businessId"=${access.businessId}
        AND (m."recipientId" IS NULL OR m."senderId"=${access.userId} OR m."recipientId"=${access.userId})
      ORDER BY m."createdAt" DESC LIMIT 300
    ) q
    LEFT JOIN "InternalChatReceipt" r ON r."messageId"=q."id" AND r."userId"=${access.userId}
    ORDER BY q."createdAt" ASC
  `
  return NextResponse.json({
    currentUserId: access.userId,
    users,
    messages: messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() })),
  })
}

const createSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  recipientId: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
  const access = await getAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Mesaj invalid.' }, { status: 400 })
  await ensureInternalChatStorage()
  const recipientId = parsed.data.recipientId || null
  if (recipientId) {
    const user = await prisma.user.findFirst({ where: { id: recipientId, businessId: access.businessId }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'Destinatar invalid.' }, { status: 400 })
  }
  const id = crypto.randomUUID()
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "InternalChatMessage" ("id", "businessId", "senderId", "recipientId", "text") VALUES (${id}, ${access.businessId}, ${access.userId}, ${recipientId}, ${parsed.data.text})`
    if (recipientId && recipientId !== access.userId) {
      await tx.$executeRaw`INSERT INTO "InternalChatReceipt" ("messageId", "userId") VALUES (${id}, ${recipientId}) ON CONFLICT DO NOTHING`
    } else if (!recipientId) {
      await tx.$executeRaw`INSERT INTO "InternalChatReceipt" ("messageId", "userId") SELECT ${id}, "id" FROM "User" WHERE "businessId"=${access.businessId} AND "id"<>${access.userId} ON CONFLICT DO NOTHING`
    }
  })
  return NextResponse.json({ success: true, id })
}

const readSchema = z.object({ messageIds: z.array(z.string()).max(300) })

export async function PATCH(request: NextRequest) {
  const access = await getAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const parsed = readSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await ensureInternalChatStorage()
  if (parsed.data.messageIds.length) {
    await prisma.$executeRaw`UPDATE "InternalChatReceipt" r SET "readAt"=CURRENT_TIMESTAMP FROM "InternalChatMessage" m WHERE r."messageId"=m."id" AND r."userId"=${access.userId} AND m."businessId"=${access.businessId} AND r."messageId" IN (${Prisma.join(parsed.data.messageIds)})`
  }
  return NextResponse.json({ success: true })
}