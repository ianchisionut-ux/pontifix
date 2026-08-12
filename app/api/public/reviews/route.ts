import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = rateLimit(`review-lookup:${ip}`, 20, 10 * 60 * 1000)
  if (!allowed) return NextResponse.json({ error: 'Prea multe încercări.' }, { status: 429 })

  const slug = req.nextUrl.searchParams.get('slug')
  const phone = req.nextUrl.searchParams.get('phone')?.trim()
  if (!slug || !phone) return NextResponse.json({ error: 'Date lipsă.' }, { status: 400 })

  const business = await prisma.business.findUnique({ where: { slug } })
  if (!business || !business.publicListed) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const bookings = await prisma.booking.findMany({
    where: {
      businessId: business.id,
      status: 'COMPLETED',
      review: null,
      customer: { phone },
    },
    include: { service: true },
    orderBy: { startAt: 'desc' },
    take: 5,
  })

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      serviceName: b.service.name,
      date: b.startAt.toISOString(),
    })),
  })
}
