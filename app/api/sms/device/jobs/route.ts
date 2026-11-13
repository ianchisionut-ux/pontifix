import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authenticateSmsDevice } from '@/lib/sms-gateway'

type SmsJob = { id: string; recipient: string; message: string }

export async function GET(request: NextRequest) {
  const device = await authenticateSmsDevice(request.headers.get('authorization'))
  if (!device) return NextResponse.json({ error: 'Telefon neautorizat.' }, { status: 401 })
  await prisma.$executeRaw`UPDATE "SmsNativeDevice" SET "lastSeenAt"=CURRENT_TIMESTAMP WHERE "businessId"=${device.businessId}`
  await prisma.$executeRaw`
    UPDATE "SmsOutbound" SET "state"='Failed', "error"='Mesaj expirat după o oră fără preluare.', "updatedAt"=CURRENT_TIMESTAMP
    WHERE "businessId"=${device.businessId} AND "transport"='native' AND "state"='Pending'
      AND "createdAt" < CURRENT_TIMESTAMP - INTERVAL '1 hour'
  `
  const jobs = await prisma.$queryRaw<SmsJob[]>`
    UPDATE "SmsOutbound" SET "state"='Dispatched', "updatedAt"=CURRENT_TIMESTAMP
    WHERE "id" = (
      SELECT "id" FROM "SmsOutbound"
      WHERE "businessId"=${device.businessId} AND "transport"='native' AND "state"='Pending'
      ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "recipient", "message"
  `
  return NextResponse.json({ job: jobs[0] ? { id: jobs[0].id, to: jobs[0].recipient, text: jobs[0].message } : null }, { headers: { 'Cache-Control': 'no-store' } })
}

const reportSchema = z.object({ id: z.string().uuid(), status: z.enum(['SENT', 'FAILED']), error: z.string().max(500).optional() })

export async function POST(request: NextRequest) {
  const device = await authenticateSmsDevice(request.headers.get('authorization'))
  if (!device) return NextResponse.json({ error: 'Telefon neautorizat.' }, { status: 401 })
  const parsed = reportSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Raport invalid.' }, { status: 400 })
  const { id, status, error } = parsed.data
  const state = status === 'SENT' ? 'Sent' : 'Failed'
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "SmsOutbound" SET "state"=${state}, "error"=${status === 'FAILED' ? error || 'Trimiterea de pe telefon a eșuat.' : null}, "updatedAt"=CURRENT_TIMESTAMP
    WHERE "id"=${id} AND "businessId"=${device.businessId} AND "transport"='native' AND "state"='Dispatched'
    RETURNING "id"
  `
  if (!rows.length) {
    const existing = await prisma.$queryRaw<Array<{ state: string }>>`
      SELECT "state" FROM "SmsOutbound" WHERE "id"=${id} AND "businessId"=${device.businessId} AND "transport"='native' LIMIT 1
    `
    if (existing[0]?.state !== state) return NextResponse.json({ error: 'SMS-ul nu este în curs de trimitere.' }, { status: 409 })
  }
  await prisma.$executeRaw`UPDATE "SmsNativeDevice" SET "lastSeenAt"=CURRENT_TIMESTAMP WHERE "businessId"=${device.businessId}`
  return NextResponse.json({ success: true })
}
