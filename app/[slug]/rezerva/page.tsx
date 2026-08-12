import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PublicHeader } from '@/components/ui/public-header'
import { BackLink } from '@/components/ui/back-link'
import BookingFlow from './booking-flow'
import { ensureVenueService } from '@/lib/venue-services'

const CATEGORY_LABEL: Record<string, string> = {
  SALON: 'Salon',
  EVENT_VENUE: 'Spații evenimente',
  HOTEL: 'Hotel',
  PENSIUNE: 'Pensiune',
  CLINICA: 'Clinică medicală',
}

const WEEKDAY_SHORT = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']

function summarizeOpenDays(workingHours: { weekday: number }[]) {
  const openDays = [...new Set(workingHours.map((h) => h.weekday))].sort((a, b) => a - b)
  if (openDays.length === 0) return null
  if (openDays.length === 7) return 'Deschis zilnic'
  // grupăm zile consecutive (ex: 1,2,3,4,5 -> "Lun–Vin")
  const first = openDays[0]
  const last = openDays[openDays.length - 1]
  const isConsecutive = openDays.every((d, i) => i === 0 || d === openDays[i - 1] + 1)
  if (isConsecutive) return `Deschis ${WEEKDAY_SHORT[first]}–${WEEKDAY_SHORT[last]}`
  return `Deschis ${openDays.map((d) => WEEKDAY_SHORT[d]).join(', ')}`
}

export default async function RezervaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: { name: 'asc' } },
      resources: { orderBy: { name: 'asc' } },
      workingHours: true,
    },
  })

  if (!business || !business.publicListed || !business.accountActive) notFound()
  if (business.category === 'HOTEL' || business.category === 'PENSIUNE') notFound() // în dezvoltare

  const venueServices = business.category === 'EVENT_VENUE'
    ? await Promise.all(business.resources.map(async (resource) => ({ resource, service: await ensureVenueService(resource) })))
    : []

  const initials = business.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const openSummary = summarizeOpenDays(business.workingHours)
  const accent = business.brandColor || 'var(--accent)'
  const accentSoft = business.brandColor ? `${business.brandColor}1a` : 'var(--accent-soft)'

  return (
    <>
      <PublicHeader />

      {/* banner tip Fresha — avatar cu inițiale, nume, categorie · program */}
      <div className="px-4 sm:px-6 py-6 sm:py-8" style={{ background: accent }}>
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white font-semibold text-lg shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-semibold text-lg sm:text-xl truncate">{business.name}</h1>
            <p className="text-white/80 text-sm">
              {CATEGORY_LABEL[business.category]}
              {openSummary ? ` · ${openSummary}` : ''}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-5">
          <BackLink href={`/${slug}`} label={`Înapoi la ${business.name}`} />
        </div>

        <BookingFlow
          businessId={business.id}
          businessSlug={business.slug}
          category={business.category}
          isMultiPractitioner={business.teamSize > 1}
          accentColor={accent}
          accentSoftColor={accentSoft}
          services={(business.category === 'EVENT_VENUE' ? venueServices.map(({ resource, service }) => ({
            id: service.id,
            resourceId: resource.id,
            name: resource.name,
            durationMin: 60,
            price: resource.basePrice ? Number(resource.basePrice) : null,
            requiresDeposit: service.requiresDeposit,
            depositAmount: service.depositAmount ? Number(service.depositAmount) : null,
          })) : business.services.map((s) => ({
            id: s.id,
            resourceId: null,
            name: s.name,
            durationMin: s.durationMin,
            price: s.price ? Number(s.price) : null,
            requiresDeposit: s.requiresDeposit,
            depositAmount: s.depositAmount ? Number(s.depositAmount) : null,
          })))}
          canPayOnline={!!business.paymentProcessor}
        />
      </main>
    </>
  )
}
