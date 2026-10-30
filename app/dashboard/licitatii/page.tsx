import { redirect } from 'next/navigation'
import { getPageSession } from '@/lib/page-session'
import { listTenders } from '@/lib/tenders'
import { TendersManager } from '@/components/tenders/tenders-manager'

export const dynamic = 'force-dynamic'

export default async function TendersPage() {
  const session = await getPageSession()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) redirect('/login')
  const tenders = await listTenders(businessId)
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return <div className="mx-auto max-w-[1800px] p-4 lg:p-8"><TendersManager initialTenders={tenders} today={today} canManage={['OWNER', 'SUPER_ADMIN'].includes((session as any)?.role)} /></div>
}
