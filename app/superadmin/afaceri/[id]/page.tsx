import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { BackLink } from '@/components/ui/back-link'
import BusinessAdminPanel from './business-admin-panel'

export default async function SuperAdminBusinessDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [business, revenueAgg] = await Promise.all([
    prisma.business.findUnique({
      where: { id },
      include: {
        channels: true,
        users: { where: { role: 'OWNER' } },
        _count: { select: { bookings: true } },
      },
    }),
    // venit estimat brut (aproximativ — sumă preț servicii pentru rezervările CONFIRMED/COMPLETED)
    // — independentă de "business", rulează în paralel; dacă afacerea nu există, pur și
    // simplu ignorăm rezultatul mai jos (cost mic, câștig real în cazul normal, frecvent)
    prisma.booking.findMany({
      where: { businessId: id, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      include: { service: true },
    }),
  ])

  if (!business) notFound()

  const totalRevenue = revenueAgg.reduce((sum, b) => sum + Number(b.service.price ?? 0), 0)

  return (
    <div className="p-4 lg:p-8 max-w-6xl">
      <div className="mb-4">
        <BackLink href="/superadmin/afaceri" label="Înapoi la afaceri" />
      </div>

      <BusinessAdminPanel
        business={{
          id: business.id,
          slug: business.slug,
          name: business.name,
          category: business.category,
          accountActive: business.accountActive,
          publicListed: business.publicListed,
          ownerEmail: business.users[0]?.email ?? null,
          bookingsCount: business._count.bookings,
          revenue: totalRevenue,
          planName: business.planName,
          teamSize: business.teamSize,
          billingStatus: business.billingStatus,
          billingNote: business.billingNote,
        }}
        channels={business.channels.map((c) => ({
          id: c.id,
          type: c.type,
          externalId: c.externalId,
          wabaId: c.wabaId,
          status: c.status,
        }))}
      />
    </div>
  )
}
