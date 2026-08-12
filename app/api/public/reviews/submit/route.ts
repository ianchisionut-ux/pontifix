import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recalculateBusinessRating } from '@/lib/reviews'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const schema = z.object({
  bookingId: z.string(),
  phone: z.string().min(6),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = rateLimit(`review-submit:${ip}`, 5, 60 * 60 * 1000) // 5/oră/IP
  if (!allowed) return NextResponse.json({ error: 'Prea multe încercări. Așteaptă puțin.' }, { status: 429 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })

  const { bookingId, phone, rating, comment } = parsed.data

  // reverificăm eligibilitatea direct pe server — nu ne bazăm pe ce a returnat lookup-ul
  // mai devreme, ca cineva să nu poată trimite o recenzie pentru o programare care nu e a lui
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, review: true },
  })

  if (!booking || booking.status !== 'COMPLETED' || booking.customer.phone !== phone) {
    return NextResponse.json({ error: 'Programarea nu a fost găsită sau nu poate fi recenzată.' }, { status: 400 })
  }
  if (booking.review) {
    return NextResponse.json({ error: 'Această programare a fost deja recenzată.' }, { status: 409 })
  }

  await prisma.review.create({
    data: {
      businessId: booking.businessId,
      bookingId: booking.id,
      authorName: booking.customer.name ?? 'Client',
      rating,
      comment: comment || null,
      source: 'bookeasy',
    },
  })

  await recalculateBusinessRating(booking.businessId)

  return NextResponse.json({ success: true })
}
