import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { AttendanceSettingsForm } from '@/components/attendance/attendance-settings-form'
import { WhatsAppSettingsForm } from '@/components/whatsapp-settings-form'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const isSuperAdmin = (session as any)?.role === 'SUPER_ADMIN'
  if (!businessId) redirect('/login')

  const [business, whatsapp] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, break1Start: true, break1End: true, workingHours: { orderBy: { weekday: 'asc' } } },
    }),
    isSuperAdmin
      ? prisma.channel.findFirst({
          where: { businessId, type: 'WHATSAPP' },
          select: { externalId: true, wabaId: true, accessToken: true, enabledByOwner: true, status: true },
        })
      : null,
  ])

  const first = business?.workingHours[0]
  return <div className="p-4 lg:p-8 max-w-5xl mx-auto">
    <div className="mb-6">
      <h1 className="text-2xl font-semibold">Configurare</h1>
      <p className="text-sm text-slate-500 mt-1">Regulile organizației și programul automat de lucru.</p>
    </div>
    <AttendanceSettingsForm
      companyName={business?.name ?? 'Compania mea'}
      weekdays={business?.workingHours.map((item) => item.weekday) ?? [1, 2, 3, 4, 5]}
      startTime={first?.startTime ?? '09:00'}
      endTime={first?.endTime ?? '17:30'}
      breakStart={business?.break1Start ?? '12:00'}
      breakEnd={business?.break1End ?? '12:30'}
    />
    {isSuperAdmin && <WhatsAppSettingsForm
      phoneNumberId={whatsapp?.externalId ?? ''}
      wabaId={whatsapp?.wabaId ?? ''}
      configured={!!whatsapp?.accessToken}
      enabled={whatsapp?.enabledByOwner ?? false}
    />}
  </div>
}
