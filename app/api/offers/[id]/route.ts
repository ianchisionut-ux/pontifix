import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'
import { defaultConnectionFields } from '@/lib/connection-fields'
import { createConnectionCase } from '@/lib/connection-store'
import { sendBusinessEmail } from '@/lib/email-settings'

const updateSchema = z.object({
  status: z.enum(['NEW', 'REVIEWING', 'QUOTED', 'ACCEPTED', 'REJECTED', 'ARCHIVED']).optional(),
  internalNotes: z.string().trim().max(4000).nullable().optional(),
  estimatedValue: z.number().min(0).max(1_000_000_000).nullable().optional(),
  contractNumber: z.string().trim().max(40).optional(),
})

type QuoteRow = {
  status: string; internalNotes: string | null; estimatedValue: number | null
  name: string; email: string; phone: string; location: string | null
  atrPathname: string | null; atrName: string | null; atrOcrData: Record<string, unknown> | null
  offerData: Record<string, unknown> | null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Contul are acces doar pentru vizualizare.' }, { status: 403 })
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await ensureQuoteStorage()
  const { id } = await params
  const current = await prisma.$queryRaw<QuoteRow[]>`
    SELECT "status", "internalNotes", "estimatedValue", "name", "email", "phone", "location",
      "atrPathname", "atrName", "atrOcrData", "offerData"
    FROM "QuoteRequest" WHERE "id"=${id} AND ("businessId"=${access.businessId} OR "businessId" IS NULL) LIMIT 1
  `
  if (!current[0]) return NextResponse.json({ error: 'Cererea nu există.' }, { status: 404 })
  const quote = current[0]
  const { contractNumber, ...quotePatch } = parsed.data
  const next = { ...quote, ...quotePatch }
  if (next.status === 'ACCEPTED' && quote.status !== 'ACCEPTED' && !contractNumber) return NextResponse.json({ error: 'Introdu Numărul contractului pentru a genera NIB-ul.' }, { status: 400 })

  let nib: string | null = null
  let notificationSent = false
  if (next.status === 'ACCEPTED') {
    const ocr = quote.atrOcrData || {}
    const offer = quote.offerData || {}
    const fields = defaultConnectionFields()
    fields.NrContract = contractNumber || fields.NrContract
    fields.Beneficiar = String(offer.customerName || ocr.customerName || quote.name || '')
    fields.Telefon = String(offer.customerPhone || ocr.customerPhone || quote.phone || '')
    fields.Amplasament = String(offer.location || ocr.workAddress || quote.location || '')
    fields.AmplasamentA3 = fields.Amplasament || fields.AmplasamentA3
    fields.ATR = [ocr.atrNumber && `nr. ${ocr.atrNumber}`, ocr.atrDate && `din ${ocr.atrDate}`].filter(Boolean).join(' ')
    fields.TipBransament = String(offer.connectionType || fields.TipBransament)
    let created: Awaited<ReturnType<typeof createConnectionCase>>
    try {
      created = await createConnectionCase({
        businessId: access.businessId, fields, atrPathname: quote.atrPathname, atrName: quote.atrName,
        createdByEmail: access.session?.user?.email || null, quoteRequestId: id,
      })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'NIB-ul nu a putut fi atribuit.' }, { status: 409 })
    }
    nib = created.nib
    if (created.created && quote.email) {
      const appUrl = (process.env.APP_URL || 'https://elmontz.vercel.app').replace(/\/$/, '')
      notificationSent = await sendBusinessEmail(access.businessId, {
        to: quote.email,
        subject: `Dosarul branșamentului a fost aprobat – ${nib}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#082b4d"><h2>Oferta a fost acceptată</h2><p>Bună ziua, <strong>${fields.Beneficiar}</strong>,</p><p>Dosarul branșamentului dumneavoastră a fost aprobat și a primit numărul de identificare:</p><p style="font-size:24px;font-weight:800;color:#197fb5">${nib}</p><p>Păstrați acest număr. Puteți verifica oricând stadiul branșamentului pe site-ul Elmont:</p><p><a href="${appUrl}/#verifica-bransament" style="display:inline-block;background:#0d5d8b;color:white;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Verifică stadiul</a></p><p>Cu stimă,<br><strong>Elmont S.A.</strong></p></div>`,
      }).then(() => true).catch(() => false)
    }
  }

  await prisma.$executeRaw`
    UPDATE "QuoteRequest" SET "status"=${next.status}, "internalNotes"=${next.internalNotes},
      "estimatedValue"=${next.estimatedValue}, "businessId"=COALESCE("businessId", ${access.businessId}), "updatedAt"=CURRENT_TIMESTAMP
    WHERE "id"=${id} AND ("businessId"=${access.businessId} OR "businessId" IS NULL)
  `
  revalidatePath('/dashboard/oferte')
  revalidatePath('/dashboard/bransamente')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/rapoarte')
  return NextResponse.json({ success: true, nib, notificationSent })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Contul are acces doar pentru vizualizare.' }, { status: 403 })
  await ensureQuoteStorage()
  const { id } = await params
  const linked = await prisma.$queryRaw<Array<{ nib: string }>>`SELECT "nib" FROM "ConnectionCase" WHERE "quoteRequestId"=${id} LIMIT 1`.catch(() => [])
  if (linked[0]) return NextResponse.json({ error: `Oferta are deja branșamentul ${linked[0].nib} și nu poate fi ștearsă.` }, { status: 409 })
  const removed = await prisma.$executeRaw`DELETE FROM "QuoteRequest" WHERE "id"=${id} AND ("businessId"=${access.businessId} OR "businessId" IS NULL)`
  if (!removed) return NextResponse.json({ error: 'Cererea nu există.' }, { status: 404 })

  revalidatePath('/dashboard/oferte')
  return NextResponse.json({ success: true })
}