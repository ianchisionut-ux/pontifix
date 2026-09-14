import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { getOfferAccess } from '@/lib/offer-access'
import { OffersManager } from '@/components/offers/offers-manager'

export const dynamic = 'force-dynamic'

export default async function OffersPage() {
  const access = await getOfferAccess()
  if (!access) redirect('/dashboard')
  await ensureQuoteStorage()
  await ensureConnectionStorage()
  const rows = await prisma.$queryRaw<any[]>`
    SELECT q."id", q."name", q."email", q."phone", q."serviceType", q."location", q."message", q."atrPathname", q."atrName",
      q."status", q."internalNotes", q."estimatedValue", q."atrOcrData", q."offerData", q."offerSentAt", q."offerEmailSentAt",
      q."offerWhatsappSentAt", q."createdAt", q."updatedAt", c."nib" AS "connectionNib"
    FROM "QuoteRequest" q
    LEFT JOIN "ConnectionCase" c ON c."quoteRequestId"=q."id" AND c."businessId"=${access.businessId}
    WHERE q."businessId"=${access.businessId} OR q."businessId" IS NULL
    ORDER BY q."createdAt" DESC
  `
  const offers = rows.map((offer) => ({ ...offer, createdAt: offer.createdAt.toISOString(), updatedAt: offer.updatedAt.toISOString(), offerSentAt: offer.offerSentAt?.toISOString() || null, offerEmailSentAt: offer.offerEmailSentAt?.toISOString() || null, offerWhatsappSentAt: offer.offerWhatsappSentAt?.toISOString() || null }))
  return <div className="mx-auto max-w-[1600px] p-4 lg:p-8"><OffersManager initialOffers={offers} canManage={access.canManage}/></div>
}