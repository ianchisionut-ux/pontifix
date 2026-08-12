import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Rută publică — nu necesită autentificare, doar date publice necesare hărții
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') // SALON | EVENT_VENUE | null (toate)
  const city = req.nextUrl.searchParams.get('city')

  const businesses = await prisma.business.findMany({
    where: {
      publicListed: true,
      latitude: { not: null },
      longitude: { not: null },
      // Hotel/Pensiune există în sistem (pot fi create din superadmin), dar nu apar
      // încă public — partea aia de produs nu e gata
      category: { in: category ? [category as any] : ['SALON', 'EVENT_VENUE', 'CLINICA'] },
      ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      city: true,
      address: true,
      latitude: true,
      longitude: true,
      rating: true,
      reviewCount: true,
    },
  })

  return NextResponse.json({ businesses })
}
