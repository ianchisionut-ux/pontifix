import { prisma } from './prisma'
import { encrypt, decrypt } from './crypto'

const STAR_RATING_TO_NUMBER: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

// Google Business Profile expiră token-urile de acces relativ des — dacă a expirat,
// îl reîmprospătăm cu refresh_token-ul salvat, înainte de a face cererea reală
async function getValidAccessToken(channel: { id: string; accessToken: string; refreshToken: string | null; expiresAt: Date | null }) {
  const isExpired = channel.expiresAt && channel.expiresAt.getTime() < Date.now() + 60_000
  if (!isExpired || !channel.refreshToken) return decrypt(channel.accessToken)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(channel.refreshToken),
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Reîmprospătarea token-ului Google a eșuat.')

  await prisma.channel.update({
    where: { id: channel.id },
    data: { accessToken: encrypt(data.access_token), expiresAt: new Date(Date.now() + data.expires_in * 1000) },
  })

  return data.access_token as string
}

// aduce recenziile Google pentru o singură afacere și le salvează/actualizează în tabela
// proprie de recenzii — idempotent, poate fi rulat oricând, safe de rulat repetat
export async function syncGoogleReviews(businessId: string): Promise<{ synced: number; error?: string }> {
  const channel = await prisma.channel.findFirst({
    where: { businessId, type: 'GOOGLE_BUSINESS', status: 'ACTIVE', enabledByOwner: true },
  })
  if (!channel) return { synced: 0, error: 'Google Business Profile nu e conectat sau nu e activ pentru această afacere.' }

  let accessToken: string
  try {
    accessToken = await getValidAccessToken(channel)
  } catch (err: any) {
    return { synced: 0, error: err.message }
  }

  // externalId e deja numele complet al resursei locației (ex: "accounts/123/locations/456")
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${channel.externalId}/reviews`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()

  if (!res.ok) {
    return { synced: 0, error: data?.error?.message ?? `Google a respins cererea (status ${res.status})` }
  }

  const reviews = (data.reviews ?? []).filter((r: any) => !!r.reviewId)

  // fiecare recenzie e independentă (externalReviewId diferit) — nicio nevoie să
  // scriem una câte una în bază, mai ales la o afacere cu multe recenzii de sincronizat
  await Promise.all(
    reviews.map((r: any) =>
      prisma.review.upsert({
        where: { businessId_source_externalReviewId: { businessId, source: 'google', externalReviewId: r.reviewId } },
        create: {
          businessId,
          source: 'google',
          externalReviewId: r.reviewId,
          authorName: r.reviewer?.displayName ?? 'Client Google',
          rating: STAR_RATING_TO_NUMBER[r.starRating] ?? 5,
          comment: r.comment ?? null,
          reply: r.reviewReply?.comment ?? null,
          createdAt: r.createTime ? new Date(r.createTime) : new Date(),
        },
        update: {
          rating: STAR_RATING_TO_NUMBER[r.starRating] ?? 5,
          comment: r.comment ?? null,
          reply: r.reviewReply?.comment ?? null,
        },
      })
    )
  )

  return { synced: reviews.length }
}
