import { redirect } from 'next/navigation'
import { getConnectionAccess } from '@/lib/connection-access'
import { SmsGatewayDashboard } from '@/components/sms-gateway-dashboard'

export const dynamic = 'force-dynamic'

export default async function SmsPage() {
  const access = await getConnectionAccess()
  if (!access) redirect('/login')
  if (!access.canManage) return <main className="flex min-h-dvh items-center justify-center bg-[#eef6fb] p-6 text-center text-[#082b4d]"><div><h1 className="text-2xl font-bold">Acces restricționat</h1><p className="mt-2">Gateway-ul SMS poate fi configurat și utilizat doar de Super Admin.</p></div></main>
  return <SmsGatewayDashboard />
}
