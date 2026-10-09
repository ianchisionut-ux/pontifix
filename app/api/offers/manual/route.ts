import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'

export async function POST() {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Contul are acces doar pentru vizualizare.' }, { status: 403 })

  await ensureQuoteStorage()
  const id = crypto.randomUUID()
  const rows = await prisma.$queryRaw<Array<{ createdAt: Date; updatedAt: Date }>>`
    INSERT INTO "QuoteRequest" ("id", "name", "email", "phone", "serviceType", "businessId", "status")
    VALUES (${id}, 'Beneficiar de completat', '', '', 'Branșament electric', ${access.businessId}, 'NEW')
    RETURNING "createdAt", "updatedAt"
  `
  revalidatePath('/dashboard/oferte')
  return NextResponse.json({
    offer: {
      id, name: 'Beneficiar de completat', email: '', phone: '', serviceType: 'Branșament electric',
      location: null, message: null, atrPathname: null, atrName: null, status: 'NEW',
      internalNotes: null, estimatedValue: null, atrOcrData: null, offerData: null,
      offerSentAt: null, offerEmailSentAt: null, offerWhatsappSentAt: null, connectionNib: null,
      createdAt: rows[0].createdAt.toISOString(), updatedAt: rows[0].updatedAt.toISOString(),
    },
  }, { status: 201 })
}
