import { NextResponse } from 'next/server'
import { getConnectionAccess } from '@/lib/connection-access'
import { ensureSmsStorage } from '@/lib/sms-gateway'
import { prisma } from '@/lib/prisma'

type SmsRow = { id: string; nib: string; beneficiary: string; recipient: string; message: string; gatewayId: string | null; state: string; error: string | null; createdAt: Date; updatedAt: Date }

export async function GET() {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate vedea mesajele SMS.' }, { status: 403 })
  await ensureSmsStorage()
  const rows = await prisma.$queryRaw<SmsRow[]>`
    SELECT "id", "nib", "beneficiary", "recipient", "message", "gatewayId", "state", "error", "createdAt", "updatedAt"
    FROM "SmsOutbound" WHERE "businessId"=${access.businessId} ORDER BY "createdAt" DESC LIMIT 30
  `
  return NextResponse.json(rows.map(({ gatewayId, ...row }) => ({ ...row, gatewayId: gatewayId || undefined })), { headers: { 'Cache-Control': 'no-store' } })
}
