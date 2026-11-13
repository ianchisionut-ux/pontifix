import { NextResponse } from 'next/server'
import { getConnectionAccess } from '@/lib/connection-access'
import { createSmsDeviceToken, ensureSmsStorage, getSmsGatewayConfig } from '@/lib/sms-gateway'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate asocia telefonul.' }, { status: 403 })
  await ensureSmsStorage()
  const { token, hash } = createSmsDeviceToken(access.businessId)
  await prisma.$executeRaw`
    UPDATE "SmsOutbound" SET "state"='Cancelled', "error"='Asocierea telefonului a fost reînnoită.', "updatedAt"=CURRENT_TIMESTAMP
    WHERE "businessId"=${access.businessId} AND "transport"='native' AND "state"='Pending'
  `
  await prisma.$executeRaw`
    INSERT INTO "SmsNativeDevice" ("businessId", "tokenHash", "enabled")
    VALUES (${access.businessId}, ${hash}, true)
    ON CONFLICT ("businessId") DO UPDATE SET "tokenHash"=EXCLUDED."tokenHash", "enabled"=true,
      "lastSeenAt"=NULL, "updatedAt"=CURRENT_TIMESTAMP
  `
  return NextResponse.json({ token }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE() {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate opri gateway-ul.' }, { status: 403 })
  const config = await getSmsGatewayConfig(access.businessId)
  if (config) {
    await prisma.$executeRaw`UPDATE "SmsNativeDevice" SET "enabled"=false, "updatedAt"=CURRENT_TIMESTAMP WHERE "businessId"=${access.businessId}`
    await prisma.$executeRaw`
      UPDATE "SmsOutbound" SET "state"='Cancelled', "error"='Gateway-ul a fost oprit.', "updatedAt"=CURRENT_TIMESTAMP
      WHERE "businessId"=${access.businessId} AND "transport"='native' AND "state"='Pending'
    `
  }
  return NextResponse.json({ success: true })
}
