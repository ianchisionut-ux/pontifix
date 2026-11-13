import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncDeerBorderouri } from '@/lib/deer-borderou-mail'
import { ensureEmailStorage } from '@/lib/email-settings'
import { notifyNewDeerDocuments } from '@/lib/deer-borderou-notifications'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureEmailStorage()
  const businesses = await prisma.$queryRaw<Array<{ businessId: string }>>`
    SELECT "businessId" FROM "BusinessEmailSettings" WHERE "enabled"=true AND "smtpPasswordEncrypted" IS NOT NULL
  `
  const results = []
  let failures = 0
  for (const { businessId } of businesses) {
    try {
      const sync = await syncDeerBorderouri(businessId)
      const notification = await notifyNewDeerDocuments(businessId)
      results.push({ businessId, ...sync, notification })
    }
    catch (error) { failures++; console.error('DEER borderou cron:', businessId, error); results.push({ businessId, error: 'Sincronizarea sau notificarea a eșuat.' }) }
  }
  return NextResponse.json({ results }, { status: failures ? 502 : 200 })
}
