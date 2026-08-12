import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import Link from 'next/link'
import BusinessRowActions from './business-row-actions'
import CreateBusinessButton from './create-business-button'

const CATEGORY_LABEL: Record<string, string> = {
  SALON: 'Salon',
  EVENT_VENUE: 'Spații evenimente',
  HOTEL: 'Hotel',
  PENSIUNE: 'Pensiune',
  CLINICA: 'Clinică',
}

const STATUS_LABEL: Record<string, string> = {
  GRATUIT: 'Gratuit',
  NEPLATIT: 'Neplătit',
  PLATIT: 'Plătit',
  RESTANT: 'Restant',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  GRATUIT: 'neutral',
  NEPLATIT: 'warning',
  PLATIT: 'success',
  RESTANT: 'danger',
}

export default async function SuperAdminBusinesses({
  searchParams,
}: {
  searchParams: Promise<{ neplatite?: string }>
}) {
  const { neplatite } = await searchParams
  const onlyUnpaid = neplatite === '1'

  const businesses = await prisma.business.findMany({
    where: onlyUnpaid ? { billingStatus: { in: ['NEPLATIT', 'RESTANT'] } } : {},
    include: { _count: { select: { bookings: true, users: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
        <h1 className="text-2xl font-semibold">Afaceri</h1>
        <CreateBusinessButton />
      </div>
      <p className="text-sm text-gray-500 mb-4">{businesses.length} afaceri {onlyUnpaid ? 'neplătite' : 'înregistrate'}</p>

      <div className="flex gap-2 mb-4">
        <Link href="/superadmin/afaceri" className={`text-sm px-3 py-1.5 rounded-full border ${!onlyUnpaid ? 'bg-gray-900 text-white' : ''}`}>
          Toate
        </Link>
        <Link href="/superadmin/afaceri?neplatite=1" className={`text-sm px-3 py-1.5 rounded-full border ${onlyUnpaid ? 'bg-red-600 text-white border-red-600' : ''}`}>
          Doar neplătite
        </Link>
      </div>

      <Card className="p-0 overflow-hidden printable">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left border-b border-[var(--border-soft)]">
              <th className="py-3 px-5 font-medium text-gray-500">Nume</th>
              <th className="font-medium text-gray-500">Categorie</th>
              <th className="font-medium text-gray-500">Profil</th>
              <th className="font-medium text-gray-500">Plată</th>
              <th className="font-medium text-gray-500">Rezervări</th>
              <th className="font-medium text-gray-500">Public</th>
              <th className="font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-b border-[var(--border-soft)] last:border-0">
                <td className="py-3 px-5">
                  <Link href={`/superadmin/afaceri/${b.id}`} className="font-medium text-[var(--accent)]">
                    {b.name}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {b.city} · /{b.slug}
                  </p>
                </td>
                <td>{CATEGORY_LABEL[b.category] ?? b.category}</td>
                <td>
                  <Pill tone={b.teamSize > 1 ? 'accent' : 'neutral'}>{b.teamSize > 1 ? 'Echipă' : 'Individual'}</Pill>
                </td>
                <td>
                  <Pill tone={STATUS_TONE[b.billingStatus]}>
                    {b.planName ? `${b.planName} · ` : ''}
                    {STATUS_LABEL[b.billingStatus]}
                  </Pill>
                </td>
                <td>{b._count.bookings}</td>
                <td>
                  <Pill tone={b.publicListed ? 'success' : 'neutral'}>{b.publicListed ? 'Da' : 'Nu'}</Pill>
                </td>
                <td className="pr-5">
                  <BusinessRowActions businessId={b.id} businessName={b.name} publicListed={b.publicListed} />
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-8">
                  Nicio afacere în această categorie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  )
}
