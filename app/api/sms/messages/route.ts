import { NextResponse } from 'next/server'
import { getConnectionAccess } from '@/lib/connection-access'
import { getSmsGatewayConfig, getSmsState } from '@/lib/sms-gateway'
import { prisma } from '@/lib/prisma'

type SmsRow = { id: string; nib: string; beneficiary: string; recipient: string; message: string; gatewayId: string | null; state: string; error: string | null; createdAt: Date; updatedAt: Date }

export async function GET() {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate vedea mesajele SMS.' }, { status: 403 })
  const config = await getSmsGatewayConfig(access.businessId)
  const rows = await prisma.$queryRaw<SmsRow[]>`
    SELECT "id", "nib", "beneficiary", "recipient", "message", "gatewayId", "state", "error", "createdAt", "updatedAt"
    FROM "SmsOutbound" WHERE "businessId"=${access.businessId} ORDER BY "createdAt" DESC LIMIT 30
  `
  if (config) await Promise.allSettled(rows.slice(0, 10).filter((row) => row.gatewayId && !['Delivered', 'Failed', 'Cancelled'].includes(row.state)).map(async (row) => {
    const state = await getSmsState(config, row.gatewayId!)
    if (state !== row.state) {
      row.state = state
      await prisma.$executeRaw`UPDATE "SmsOutbound" SET "state"=${state}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${row.id} AND "businessId"=${access.businessId}`
    }
  }))
  return NextResponse.json(rows.map(({ gatewayId, ...row }) => ({ ...row, gatewayId: gatewayId || undefined })), { headers: { 'Cache-Control': 'no-store' } })
}
