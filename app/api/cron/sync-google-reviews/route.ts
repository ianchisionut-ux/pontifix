import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncGoogleReviews } from '@/lib/google-reviews'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const channels = await prisma.channel.findMany({
    where: { type: 'GOOGLE_BUSINESS', status: 'ACTIVE', enabledByOwner: true },
    select: { businessId: true },
  })

  let totalSynced = 0
  let failed = 0

  for (const { businessId } of channels) {
    const result = await syncGoogleReviews(businessId)
    if (result.error) {
      failed++
      console.error(`[sync-google-reviews] ${businessId}:`, result.error)
    } else {
      totalSynced += result.synced
    }
  }

  return NextResponse.json({ businesses: channels.length, totalSynced, failed })
}
