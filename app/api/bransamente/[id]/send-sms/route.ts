import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { getSmsGatewayConfig, normalizeRomanianMobile } from '@/lib/sms-gateway'
import { prisma } from '@/lib/prisma'

const schema = z.object({ message: z.string().trim().min(1).max(1200) })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate trimite SMS.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Mesajul SMS trebuie să aibă între 1 și 1200 de caractere.' }, { status: 400 })
  const config = await getSmsGatewayConfig(access.businessId)
  if (!config?.enabled) return NextResponse.json({ error: 'Telefonul SMS nu este asociat. Configurează-l pe sms.elmont.ro.' }, { status: 409 })
  if (!config.lastSeenAt || Date.now() - new Date(config.lastSeenAt).getTime() > 90_000) return NextResponse.json({ error: 'Telefonul SMS este offline. Pornește aplicația Elmont SMS și verifică internetul.' }, { status: 409 })
  await ensureConnectionStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ nib: string; fields: unknown }>>`
    SELECT "nib", "fields" FROM "ConnectionCase" WHERE "id"=${id} AND "businessId"=${access.businessId} LIMIT 1
  `
  if (!rows[0]) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  const fields = connectionFieldsSchema.parse(rows[0].fields)
  const recipient = normalizeRomanianMobile(fields.Telefon)
  if (!recipient) return NextResponse.json({ error: 'Numărul beneficiarului trebuie să fie un număr mobil românesc valid.' }, { status: 400 })
  const smsId = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "SmsOutbound" ("id", "businessId", "connectionId", "nib", "beneficiary", "recipient", "message", "state", "transport", "createdByEmail")
    VALUES (${smsId}, ${access.businessId}, ${id}, ${rows[0].nib}, ${fields.Beneficiar}, ${recipient}, ${parsed.data.message}, 'Pending', 'native', ${(access.session as any)?.user?.email || null})
  `
  return NextResponse.json({ queued: true, id: smsId, state: 'Pending' })
}
