import { NextResponse } from 'next/server'
import { getConnectionAccess } from '@/lib/connection-access'
import { getSmsGatewayConfig, listSmsDevices } from '@/lib/sms-gateway'

export async function GET() {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate vedea telefoanele gateway.' }, { status: 403 })
  const config = await getSmsGatewayConfig(access.businessId)
  if (!config) return NextResponse.json({ error: 'Salvează mai întâi datele contului gateway.' }, { status: 400 })
  try { return NextResponse.json(await listSmsDevices(config)) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Nu am putut încărca telefoanele.' }, { status: 502 }) }
}
