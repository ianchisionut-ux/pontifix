import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'
import { OffersManager } from '@/components/offers/offers-manager'

export const dynamic = 'force-dynamic'

export default async function OffersPage() {
  const access = await getOfferAccess()
  if (!access) redirect('/dashboard')
  await ensureQuoteStorage()
  const rows = await prisma.$queryRaw<any[]>`
    SELECT "id", "name", "email", "phone", "serviceType", "location", "message", "atrPathname", "atrName",
      "status", "internalNotes", "estimatedValue", "atrOcrData", "offerData", "offerSentAt", "offerEmailSentAt",
      "offerWhatsappSentAt", "createdAt", "updatedAt"
    FROM "QuoteRequest" WHERE "businessId"=${access.businessId} OR "businessId" IS NULL ORDER BY "createdAt" DESC
  `
  const offers = rows.map((offer) => ({ ...offer, createdAt: offer.createdAt.toISOString(), updatedAt: offer.updatedAt.toISOString(), offerSentAt: offer.offerSentAt?.toISOString() || null, offerEmailSentAt: offer.offerEmailSentAt?.toISOString() || null, offerWhatsappSentAt: offer.offerWhatsappSentAt?.toISOString() || null }))
  return <div className="mx-auto max-w-[1600px] p-4 lg:p-8"><OffersManager initialOffers={offers} canManage={access.canManage}/></div>
}