import { prisma } from '@/lib/prisma'
import { connectionTypeFromOffer, shouldReplaceGenericConnectionType } from '@/lib/offer-connection-type'

type LinkedOffer = {
  id: string
  currentType: string | null
  offerData: { serviceType?: unknown; connectionType?: unknown } | null
  serviceType: string | null
  atrOcrData: { connectionType?: unknown } | null
}

/** Bring already-linked dossiers up to date without replacing a detailed manual entry. */
export async function syncOfferConnectionTypes(businessId: string) {
  const linked = await prisma.$queryRaw<LinkedOffer[]>`
    SELECT c."id", c."fields"->>'TipBransament' AS "currentType",
      q."offerData", q."serviceType", q."atrOcrData"
    FROM "ConnectionCase" c
    JOIN "QuoteRequest" q ON q."id"=c."quoteRequestId"
    WHERE c."businessId"=${businessId} AND (q."businessId"=${businessId} OR q."businessId" IS NULL)
  `
  for (const item of linked) {
    const currentType = item.currentType || ''
    const completeType = connectionTypeFromOffer(item.offerData, item.serviceType, item.atrOcrData?.connectionType)
    if (!shouldReplaceGenericConnectionType(currentType, completeType)) continue
    await prisma.$executeRaw`
      UPDATE "ConnectionCase"
      SET "fields"=jsonb_set("fields", '{TipBransament}', to_jsonb(${completeType}::text), true),
          "updatedAt"=NOW()
      WHERE "id"=${item.id} AND "businessId"=${businessId}
        AND COALESCE("fields"->>'TipBransament', '')=${currentType}
    `
  }
}
