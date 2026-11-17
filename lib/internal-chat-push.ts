import * as webpush from 'web-push'
import { prisma } from '@/lib/prisma'

type StoredSubscription = { endpoint: string; subscription: webpush.PushSubscription }

export function internalChatPushConfigured() {
  return Boolean(process.env.SONERIE_VAPID_PUBLIC_KEY && process.env.SONERIE_VAPID_PRIVATE_KEY)
}

export async function notifyInternalChat(messageId: string, businessId: string, senderId: string, text: string) {
  if (!internalChatPushConfigured()) return

  webpush.setVapidDetails('mailto:elmont_zalau@yahoo.com', process.env.SONERIE_VAPID_PUBLIC_KEY!, process.env.SONERIE_VAPID_PRIVATE_KEY!)
  const [subscriptions, senders] = await Promise.all([
    prisma.$queryRaw<StoredSubscription[]>`
      SELECT s."endpoint", s."subscription"
      FROM "InternalChatPushSubscription" s
      JOIN "InternalChatReceipt" r ON r."userId"=s."userId" AND r."messageId"=${messageId}
      LEFT JOIN "UserAccessStatus" a ON a."userId"=s."userId"
      WHERE s."businessId"=${businessId} AND a."disabledAt" IS NULL`,
    prisma.$queryRaw<Array<{ displayName: string }>>`
      SELECT COALESCE(p."displayName", split_part(u."email", '@', 1)) AS "displayName"
      FROM "User" u LEFT JOIN "InternalChatProfile" p ON p."userId"=u."id"
      WHERE u."id"=${senderId} AND u."businessId"=${businessId} LIMIT 1`,
  ])
  const sender = senders[0]?.displayName || 'Un coleg'
  const payload = JSON.stringify({ type: 'internal-chat', id: messageId, title: `Mesaj de la ${sender}`, body: text.length > 160 ? `${text.slice(0, 157)}…` : text })
  await Promise.all(subscriptions.map(async ({ endpoint, subscription }) => {
    try {
      await webpush.sendNotification(subscription, payload, { TTL: 60 * 60, urgency: 'high', timeout: 5000 })
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await prisma.$executeRaw`DELETE FROM "InternalChatPushSubscription" WHERE "endpoint"=${endpoint}`.catch(() => undefined)
      }
      console.warn('internal_chat_push_failed', { messageId, status: status || 'network-error' })
    }
  }))
}
