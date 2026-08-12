import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import AddCustomerForm from './add-customer-form'
import { PrintButton } from '@/components/print-button'

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth()
  const businessId = (session as any)?.businessId ?? ''
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const [customers, business] = await Promise.all([
    prisma.customer.findMany({
      where: {
        businessId,
        ...(query && {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      include: { _count: { select: { bookings: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { category: true } }),
  ])

  const isClinic = business?.category === 'CLINICA'
  const label = isClinic ? 'Pacienți' : 'Clienți'

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h1 className="text-2xl font-semibold mr-1">{label}</h1>
        <span className="text-sm text-gray-500 mr-1 whitespace-nowrap">{customers.length} {label.toLowerCase()}</span>
        <div className="flex items-center gap-2">
          <form method="get" className="contents">
            <Input type="text" name="q" defaultValue={query} placeholder="Caută nume, telefon, email..." className="w-52" />
          </form>
          <PrintButton />
        </div>
      </div>

      <div className="mb-5">
        <AddCustomerForm isClinic={isClinic} />
      </div>

      {customers.length === 0 && (
        <p className="text-sm text-gray-500">
          {query ? `Niciun rezultat pentru "${query}".` : `Niciun ${isClinic ? 'pacient' : 'client'} încă.`}
        </p>
      )}

      <Card className="p-0 overflow-hidden printable">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left border-b border-[var(--border-soft)]">
              <th className="py-3 px-5 font-medium text-gray-500">Nume</th>
              <th className="font-medium text-gray-500">Telefon</th>
              <th className="font-medium text-gray-500">Email</th>
              <th className="font-medium text-gray-500">{isClinic ? 'Consultații' : 'Rezervări'}</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--surface-muted)]">
                <td className="py-3 px-5">
                  <Link href={`/dashboard/clienti/${c.id}`} className="text-[var(--accent)] font-medium">
                    {c.name ?? 'Fără nume'}
                  </Link>
                </td>
                <td>{c.phone}</td>
                <td>{c.email ?? '—'}</td>
                <td>{c._count.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  )
}
