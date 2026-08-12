import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'

const CATEGORY_LABEL: Record<string, string> = {
  SALON: 'Saloane',
  EVENT_VENUE: 'Spații evenimente',
  HOTEL: 'Hoteluri',
  PENSIUNE: 'Pensiuni',
  CLINICA: 'Clinici',
}

export default async function SuperAdminOverview() {
  const [totalBusinesses, totalBookingsLast30d, activeSubscriptions, totalCustomers] = await Promise.all([
    prisma.business.count(),
    prisma.booking.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
    prisma.customer.count(),
  ])

  const byCategory = await prisma.business.groupBy({ by: ['category'], _count: true })

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-semibold mb-1">Prezentare generală</h1>
      <p className="text-sm text-gray-500 mb-6">Toate afacerile de pe platformă</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <p className="text-sm text-gray-500 mb-1">Afaceri totale</p>
          <p className="text-3xl font-semibold">{totalBusinesses}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 mb-1">Abonamente active</p>
          <p className="text-3xl font-semibold">{activeSubscriptions}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 mb-1">Rezervări (30 zile)</p>
          <p className="text-3xl font-semibold">{totalBookingsLast30d}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 mb-1">Clienți finali totali</p>
          <p className="text-3xl font-semibold">{totalCustomers}</p>
        </Card>
      </div>

      <Card className="max-w-md">
        <h2 className="font-medium mb-3">Pe categorie</h2>
        <ul className="text-sm flex flex-col gap-2">
          {byCategory.map((c) => (
            <li key={c.category} className="flex justify-between">
              <span className="text-gray-500">{CATEGORY_LABEL[c.category] ?? c.category}</span>
              <span className="font-medium">{c._count}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
