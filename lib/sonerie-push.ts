import * as webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { ensureSonerieStorage } from '@/lib/sonerie'

type StoredSubscription = { endpoint: string; subscription: webpush.PushSubscription }

export function pushConfigured() {
  return Boolean(process.env.SONERIE_VAPID_PUBLIC_KEY && process.env.SONERIE_VAPID_PRIVATE_KEY)
}

export async function notifyIonut(id: string) {
  if (!pushConfigured()) return
  await ensureSonerieStorage()
  webpush.setVapidDetails('mailto:elmont_zalau@yahoo.com', process.env.SONERIE_VAPID_PUBLIC_KEY!, process.env.SONERIE_VAPID_PRIVATE_KEY!)
  const subscriptions = await prisma.$queryRaw<StoredSubscription[]>`
    SELECT "endpoint", "subscription" FROM "SoneriePushSubscription" WHERE "recipient"='ionut'`
  await Promise.allSettled(subscriptions.map(async ({ endpoint, subscription }) => {
    try {
      await webpush.sendNotification(subscription, JSON.stringify({ type: 'sonerie', id, title: 'Directorul te cheamă', body: 'Te rog să vii la birou.' }), { TTL: 180, urgency: 'high' })
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await prisma.$executeRaw`DELETE FROM "SoneriePushSubscription" WHERE "endpoint"=${endpoint}`
    }
  }))
}
