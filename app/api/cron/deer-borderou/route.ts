import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncDeerBorderouri } from '@/lib/deer-borderou-mail'
import { ensureEmailStorage } from '@/lib/email-settings'

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
  for (const { businessId } of businesses) {
    try { results.push({ businessId, ...(await syncDeerBorderouri(businessId)) }) }
    catch (error) { console.error('DEER borderou cron:', businessId, error); results.push({ businessId, error: 'Sincronizarea a eșuat.' }) }
  }
  return NextResponse.json({ results })
}
