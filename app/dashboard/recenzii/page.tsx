import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ReviewsManager from './reviews-manager'

export default async function RecenziiPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const [business, reviews, googleChannel] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { rating: true, reviewCount: true } }),
    prisma.review.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } }),
    prisma.channel.findFirst({ where: { businessId, type: 'GOOGLE_BUSINESS', status: 'ACTIVE', enabledByOwner: true } }),
  ])

  return (
    <ReviewsManager
      rating={business?.rating ? Number(business.rating) : null}
      reviewCount={business?.reviewCount ?? 0}
      googleConnected={!!googleChannel}
      reviews={reviews.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment,
        reply: r.reply,
        createdAt: r.createdAt.toISOString(),
        verified: r.source === 'bookeasy',
        source: r.source,
      }))}
    />
  )
}
