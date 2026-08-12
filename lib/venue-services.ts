import { prisma } from './prisma'

export function venueServiceId(resourceId: string) {
  return `venue-service-${resourceId}`
}

export async function ensureVenueService(resource: {
  id: string
  businessId: string
  name: string
  basePrice: any
}) {
  return prisma.service.upsert({
    where: { id: venueServiceId(resource.id) },
    create: {
      id: venueServiceId(resource.id),
      businessId: resource.businessId,
      name: `Închiriere ${resource.name}`,
      type: 'VENUE_RENTAL',
      durationMin: 60,
      price: resource.basePrice,
      active: true,
    },
    update: {
      name: `Închiriere ${resource.name}`,
      durationMin: 60,
      price: resource.basePrice,
      active: true,
    },
  })
}
