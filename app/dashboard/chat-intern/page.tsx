import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureInternalChatStorage } from '@/lib/ensure-internal-chat-storage'
import { InternalChatManager, type InternalChatMessage, type InternalChatUser } from '@/components/internal-chat/internal-chat-manager'

export const dynamic = 'force-dynamic'

export default async function InternalChatPage(){
  const session=await auth(); const businessId=(session as any)?.businessId as string|undefined; const userId=(session as any)?.userId as string|undefined
  if(!businessId||!userId)redirect('/login')
  await ensureInternalChatStorage()
  const users=await prisma.$queryRaw<InternalChatUser[]>`SELECT "id", "email", "role"::text AS "role" FROM "User" WHERE "businessId"=${businessId} ORDER BY "email" ASC`
  const messages=await prisma.$queryRaw<Array<Omit<InternalChatMessage,'createdAt'>&{createdAt:Date}>>`
    SELECT q.*, (r."readAt" IS NULL AND r."userId" IS NOT NULL) AS "isUnread" FROM (
      SELECT m."id",m."senderId",s."email" AS "senderEmail",m."recipientId",u."email" AS "recipientEmail",m."text",m."createdAt"
      FROM "InternalChatMessage" m JOIN "User" s ON s."id"=m."senderId" LEFT JOIN "User" u ON u."id"=m."recipientId"
      WHERE m."businessId"=${businessId} AND (m."recipientId" IS NULL OR m."senderId"=${userId} OR m."recipientId"=${userId})
      ORDER BY m."createdAt" DESC LIMIT 300
    ) q LEFT JOIN "InternalChatReceipt" r ON r."messageId"=q."id" AND r."userId"=${userId} ORDER BY q."createdAt" ASC
  `
  return <div className="mx-auto max-w-[1500px] p-4 lg:p-8"><InternalChatManager initialData={{currentUserId:userId,users,messages:messages.map((message)=>({...message,createdAt:message.createdAt.toISOString()}))}}/></div>
}