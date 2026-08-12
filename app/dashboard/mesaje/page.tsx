import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import InboxManager from './inbox-manager'
import { prisma } from '@/lib/prisma'

export default async function MesajePage() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { category: true } })
  const isClinic = business?.category === 'CLINICA'
  const isAppointmentBased = business?.category === 'SALON' || isClinic
  return <InboxManager businessId={businessId} isClinic={isClinic} isAppointmentBased={isAppointmentBased} />
}
