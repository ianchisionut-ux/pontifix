import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { ensureWhatsAppStorage } from '@/lib/ensure-whatsapp-storage'
import { sendProjectWhatsApp, whatsappFallbackUrl } from '@/lib/project-whatsapp'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate trimite mesaje pentru branșamente.' }, { status: 403 })

  await ensureConnectionStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ fields: unknown }>>`
    SELECT "fields" FROM "ConnectionCase"
    WHERE "id"=${id} AND "businessId"=${access.businessId}
    LIMIT 1
  `
  if (!rows[0]) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })

  const fields = connectionFieldsSchema.parse(rows[0].fields)
  if (!fields.Telefon) return NextResponse.json({ error: 'Beneficiarul nu are număr de telefon.' }, { status: 400 })
  if (!fields.Entitate) return NextResponse.json({ error: 'Completează mai întâi câmpul Entitate / UAT.' }, { status: 400 })

  const authority = /^prim[ăa]ria\b/i.test(fields.Entitate.trim())
    ? fields.Entitate.trim()
    : `Primăria ${fields.Entitate.trim()}`
  const message = `Bună ziua, s-a trimis pe e-mail, documentația pentru obținerea avizului la ${authority}, se poate merge la primărie pentru achitarea taxei pentru eliberarea avizului. O zi bună! (SC ELMONT S.A)`
  const fallbackUrl = whatsappFallbackUrl(fields.Telefon, message)

  await ensureWhatsAppStorage()
  const channel = await prisma.channel.findFirst({
    where: { businessId: access.businessId, type: 'WHATSAPP', status: 'ACTIVE', enabledByOwner: true },
    select: { id: true },
  })
  if (!channel) return NextResponse.json({ sent: false, fallbackUrl, message: 'WhatsApp Business nu este configurat. Se va deschide conversația cu mesajul completat.' })

  try {
    await sendProjectWhatsApp(channel.id, fields.Telefon, message)
    return NextResponse.json({ sent: true })
  } catch (error) {
    return NextResponse.json({
      sent: false,
      fallbackUrl,
      message: error instanceof Error ? error.message : 'Mesajul nu a putut fi trimis direct.',
    })
  }
}
