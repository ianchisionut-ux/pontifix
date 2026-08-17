import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { ensureWhatsAppStorage } from '@/lib/ensure-whatsapp-storage'
import { sendProjectWhatsApp, whatsappFallbackUrl } from '@/lib/project-whatsapp'
import { renderConnectionWhatsAppTemplate } from '@/lib/connection-whatsapp-templates'

const bodySchema = z.object({ message: z.string().trim().min(1).max(4000).optional() })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate trimite mesaje pentru branșamente.' }, { status: 403 })
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Mesaj invalid.' }, { status: 400 })

  await ensureConnectionStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ nib:string; fields:unknown }>>`
    SELECT "nib", "fields" FROM "ConnectionCase"
    WHERE "id"=${id} AND "businessId"=${access.businessId} LIMIT 1
  `
  if (!rows[0]) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  const fields = connectionFieldsSchema.parse(rows[0].fields)
  if (!fields.Telefon) return NextResponse.json({ error: 'Beneficiarul nu are număr de telefon.' }, { status: 400 })
  const message = parsed.data.message || renderConnectionWhatsAppTemplate('TAX_AUTHORITY', { nib: rows[0].nib, fields })
  const fallbackUrl = whatsappFallbackUrl(fields.Telefon, message)

  await ensureWhatsAppStorage()
  const channel = await prisma.channel.findFirst({ where: { businessId: access.businessId, type: 'WHATSAPP', status: 'ACTIVE', enabledByOwner: true }, select: { id: true } })
  if (!channel) return NextResponse.json({ sent: false, fallbackUrl, message: 'WhatsApp Business nu este configurat. Se va deschide conversația cu mesajul completat.' })
  try {
    await sendProjectWhatsApp(channel.id, fields.Telefon, message)
    return NextResponse.json({ sent: true })
  } catch (error) {
    return NextResponse.json({ sent: false, fallbackUrl, message: error instanceof Error ? error.message : 'Mesajul nu a putut fi trimis direct.' })
  }
}