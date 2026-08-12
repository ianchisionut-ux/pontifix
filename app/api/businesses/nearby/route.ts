import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const RADIUS_KM = 15
const LIMIT = 6

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const current = await prisma.business.findUnique({ where: { id: businessId } })
  if (!current?.latitude || !current?.longitude) {
    return NextResponse.json({ businesses: [] })
  }

  // filtrăm grosier pe un bounding box mic în SQL, apoi rafinăm exact în JS cu Haversine
  // (evită să tragem toată tabela de businessuri pentru un calcul de distanță)
  const latDelta = RADIUS_KM / 111 // ~111km per grad de latitudine
  const lngDelta = RADIUS_KM / (111 * Math.cos((current.latitude * Math.PI) / 180))

  const candidates = await prisma.business.findMany({
    where: {
      id: { not: businessId },
      publicListed: true,
      latitude: { gte: current.latitude - latDelta, lte: current.latitude + latDelta },
      longitude: { gte: current.longitude - lngDelta, lte: current.longitude + lngDelta },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      city: true,
      latitude: true,
      longitude: true,
      rating: true,
      reviewCount: true,
    },
  })

  const withDistance = candidates
    .map((b) => ({ ...b, distanceKm: haversineKm(current.latitude!, current.longitude!, b.latitude!, b.longitude!) }))
    .filter((b) => b.distanceKm <= RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, LIMIT)

  return NextResponse.json({ businesses: withDistance })
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
