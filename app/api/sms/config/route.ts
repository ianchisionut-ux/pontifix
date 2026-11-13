import { NextResponse } from 'next/server'
import { getConnectionAccess } from '@/lib/connection-access'
import { getSmsGatewayConfig, SMS_SENDER_NUMBER } from '@/lib/sms-gateway'

export async function GET() {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate configura gateway-ul SMS.' }, { status: 403 })
  const config = await getSmsGatewayConfig(access.businessId)
  return NextResponse.json({
    senderNumber: SMS_SENDER_NUMBER,
    paired: !!config,
    enabled: config?.enabled || false,
    lastSeenAt: config?.lastSeenAt || null,
    online: !!config?.lastSeenAt && Date.now() - new Date(config.lastSeenAt).getTime() < 90_000,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
