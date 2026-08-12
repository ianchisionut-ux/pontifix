import { prisma } from './prisma'

export async function recalculateBusinessRating(businessId: string) {
  const agg = await prisma.review.aggregate({
    where: { businessId },
    _avg: { rating: true },
    _count: { rating: true },
  })

  await prisma.business.update({
    where: { id: businessId },
    data: {
      rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
      reviewCount: agg._count.rating,
    },
  })
}
