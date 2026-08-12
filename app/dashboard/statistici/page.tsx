import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getAdvancedStats } from '@/lib/statsHelper'
import StatisticiCharts from './statistici-charts'

export default async function StatisticiPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const [business, analytics] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { category: true } }),
    getAdvancedStats(businessId),
  ])

  return <StatisticiCharts analytics={analytics} category={business?.category ?? 'SALON'} />
}
