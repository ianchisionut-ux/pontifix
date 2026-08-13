import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'
import { OffersManager } from '@/components/offers/offers-manager'

export const dynamic = 'force-dynamic'

type RawOffer = {
  id: string
  name: string
  email: string
  phone: string
  serviceType: string
  location: string | null
  message: string | null
  atrPathname: string | null
  atrName: string | null
  status: 'NEW' | 'REVIEWING' | 'QUOTED' | 'ACCEPTED' | 'REJECTED' | 'ARCHIVED'
  internalNotes: string | null
  estimatedValue: number | null
  createdAt: Date
  updatedAt: Date
}

export default async function OffersPage() {
  const access = await getOfferAccess()
  if (!access) redirect('/dashboard')
  await ensureQuoteStorage()
  const rows = await prisma.$queryRaw<RawOffer[]>`
    SELECT "id", "name", "email", "phone", "serviceType", "location", "message", "atrPathname", "atrName",
      "status", "internalNotes", "estimatedValue", "createdAt", "updatedAt"
    FROM "QuoteRequest"
    WHERE "businessId" = ${access.businessId} OR "businessId" IS NULL
    ORDER BY "createdAt" DESC
  `
  const offers = rows.map((offer) => ({ ...offer, createdAt: offer.createdAt.toISOString(), updatedAt: offer.updatedAt.toISOString() }))
  return <div className="mx-auto max-w-[1600px] p-4 lg:p-8"><OffersManager initialOffers={offers}/></div>
}
