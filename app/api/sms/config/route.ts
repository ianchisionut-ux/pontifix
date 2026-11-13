import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getConnectionAccess } from '@/lib/connection-access'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { getSmsGatewayConfig, listSmsDevices, SMS_SENDER_NUMBER } from '@/lib/sms-gateway'

const schema = z.object({
  username: z.string().trim().min(3).max(200),
  password: z.string().max(500).optional(),
  deviceId: z.string().trim().max(200),
  simNumber: z.number().int().min(1).max(2),
  enabled: z.boolean(),
})

export async function GET() {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate configura gateway-ul SMS.' }, { status: 403 })
  const config = await getSmsGatewayConfig(access.businessId)
  return NextResponse.json({ senderNumber: SMS_SENDER_NUMBER, configured: !!config, username: config?.username || '', deviceId: config?.deviceId || '', simNumber: config?.simNumber || 1, enabled: config?.enabled || false })
}

export async function PUT(request: NextRequest) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate configura gateway-ul SMS.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Completează utilizatorul, telefonul și slotul SIM.' }, { status: 400 })
  const previous = await getSmsGatewayConfig(access.businessId)
  const { username, password, deviceId, simNumber, enabled } = parsed.data
  if (!password && (!previous || username !== previous.username)) return NextResponse.json({ error: 'Introdu parola gateway-ului pentru acest cont.' }, { status: 400 })
  if (enabled && !deviceId) return NextResponse.json({ error: 'Selectează telefonul înainte de activare.' }, { status: 400 })
  const encryptedPassword = password ? encrypt(password) : previous!.password
  if (enabled) {
    try {
      const devices = await listSmsDevices({ username, password: encryptedPassword })
      if (!devices.some((device) => device.id === deviceId)) return NextResponse.json({ error: 'Telefonul selectat nu există în contul gateway.' }, { status: 400 })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Nu am putut verifica telefonul.' }, { status: 502 })
    }
  }
  await prisma.$executeRaw`
    INSERT INTO "SmsGatewayConfig" ("businessId", "username", "password", "deviceId", "simNumber", "enabled")
    VALUES (${access.businessId}, ${username}, ${encryptedPassword}, ${deviceId}, ${simNumber}, ${enabled})
    ON CONFLICT ("businessId") DO UPDATE SET "username"=EXCLUDED."username", "password"=EXCLUDED."password",
      "deviceId"=EXCLUDED."deviceId", "simNumber"=EXCLUDED."simNumber", "enabled"=EXCLUDED."enabled", "updatedAt"=CURRENT_TIMESTAMP
  `
  return NextResponse.json({ success: true })
}
