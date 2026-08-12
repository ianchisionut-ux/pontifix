import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ServicesManager from './services-manager'
import BusinessPhotosUploader from '@/components/business-photos-uploader'

export default async function ServiciiPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      services: { orderBy: { name: 'asc' } },
      resources: { orderBy: { name: 'asc' } },
      photos: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!business) redirect('/login')

  return (
    <>
      <div className="px-4 lg:px-8 pt-4 lg:pt-8 max-w-2xl">
        <BusinessPhotosUploader
          heroImageUrl={business.heroImageUrl}
          gallery={business.photos.map((p) => ({ id: p.id, url: p.url }))}
        />
      </div>

      <ServicesManager
        category={business.category}
        services={business.services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMin: s.durationMin,
          price: s.price ? Number(s.price) : null,
          active: s.active,
        }))}
        resources={business.resources.map((r) => ({
          id: r.id,
          name: r.name,
          capacity: r.capacity,
          basePrice: r.basePrice ? Number(r.basePrice) : null,
        }))}
      />
    </>
  )
}
