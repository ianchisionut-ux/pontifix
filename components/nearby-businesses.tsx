import { prisma } from '@/lib/prisma'
import Link from 'next/link'

const CATEGORY_LABEL: Record<string, string> = {
  SALON: 'Salon',
  EVENT_VENUE: 'Spații evenimente',
}

export default async function NearbyBusinesses({ businessId }: { businessId: string }) {
  const current = await prisma.business.findUnique({ where: { id: businessId } })
  if (!current?.latitude || !current?.longitude) return null

  const RADIUS_KM = 15
  const latDelta = RADIUS_KM / 111
  const lngDelta = RADIUS_KM / (111 * Math.cos((current.latitude * Math.PI) / 180))

  const candidates = await prisma.business.findMany({
    where: {
      id: { not: businessId },
      publicListed: true,
      latitude: { gte: current.latitude - latDelta, lte: current.latitude + latDelta },
      longitude: { gte: current.longitude - lngDelta, lte: current.longitude + lngDelta },
    },
  })

  const nearby = candidates
    .map((b) => ({ ...b, distanceKm: haversineKm(current.latitude!, current.longitude!, b.latitude!, b.longitude!) }))
    .filter((b) => b.distanceKm <= RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 6)

  if (nearby.length === 0) return null

  return (
    <div className="mt-10">
      <h2 className="text-lg font-medium mb-3">Afaceri din apropiere</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {nearby.map((b) => (
          <Link
            key={b.id}
            href={`/${b.slug}`}
            className="border rounded-lg p-3 hover:bg-gray-50 flex flex-col gap-1"
          >
            <p className="text-sm font-medium">{b.name}</p>
            <p className="text-xs text-gray-500">
              {CATEGORY_LABEL[b.category]} · {b.distanceKm.toFixed(1)} km
            </p>
            {b.rating && (
              <p className="text-xs text-gray-500">
                ★ {b.rating.toString()} ({b.reviewCount ?? 0})
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
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
