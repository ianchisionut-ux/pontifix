import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SidebarUserBlock } from '@/components/sidebar-user-block'
import { ResponsiveShell } from '@/components/responsive-shell'

// layout-ul se randează mereu din nou, la fiecare cerere — fără nicio cache, ca
// setări cum e culoarea businessului să apară imediat, nu doar la un moment ulterior
export const dynamic = 'force-dynamic'
export const revalidate = 0

const NAV_ITEMS = [
  { href: '/dashboard/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/dashboard/mesaje', label: 'Mesaje', icon: 'mesaje' },
  { href: '/dashboard/programari', label: 'Programări', icon: 'programari' },
  { href: '/dashboard/clienti', label: 'Clienți', icon: 'clienti' },
  { href: '/dashboard/servicii', label: 'Servicii', icon: 'servicii' },
  { href: '/dashboard/recenzii', label: 'Recenzii', icon: 'recenzii' },
  { href: '/dashboard/statistici', label: 'Statistici', icon: 'statistici' },
  { href: '/dashboard/setari', label: 'Setări', icon: 'setari' },
]

const CLINIC_NAV_LABEL_OVERRIDES: Record<string, string> = {
  '/dashboard/clienti': 'Pacienți',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const isSuperAdmin = (session as any)?.isSuperAdmin
  const businessId = (session as any)?.businessId
  const userEmail = (session as any)?.user?.email ?? ''

  if (isSuperAdmin && !businessId) {
    redirect('/superadmin')
  }

  let brandColor: string | null = null
  let businessName: string | null = null
  let category: string | null = null
  let teamSize = 1
  let needsOperatorCount = 0
  let unseenConfirmationsCount = 0
  if (businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, accountActive: true, onboardingDone: true, onboardingStep: true, brandColor: true, category: true, teamSize: true },
    })
    if (business && !business.accountActive) {
      redirect('/cont-suspendat')
    }
    if (business && !business.onboardingDone) {
      redirect(`/onboarding/step-${business.onboardingStep}`)
    }
    brandColor = business?.brandColor ?? null
    businessName = business?.name ?? null
    category = business?.category ?? null
    teamSize = business?.teamSize ?? 1
    // cele două interogări de mai jos sunt independente — rulează la fiecare navigare
    // din dashboard, deci paralelizarea contează real aici, nu doar teoretic
    ;[needsOperatorCount, unseenConfirmationsCount] = await Promise.all([
      prisma.conversation.count({ where: { businessId, needsOperator: true } }),
      prisma.booking.count({ where: { businessId, confirmationSeenByAdmin: false } }),
    ])
  }

  const navItems = [
    ...NAV_ITEMS.slice(0, 3),
    ...(teamSize > 1 ? [{ href: '/dashboard/medici', label: category === 'CLINICA' ? 'Medici' : 'Echipă', icon: 'medici' }] : []),
    ...NAV_ITEMS.slice(3),
  ]
    .map((item) => ({
      ...item,
      badge:
        item.href === '/dashboard/mesaje' && needsOperatorCount > 0
          ? needsOperatorCount
          : item.href === '/dashboard/programari' && unseenConfirmationsCount > 0
            ? unseenConfirmationsCount
            : undefined,
    }))
    .map((item) => ({
      ...item,
      label:
        category === 'CLINICA'
          ? CLINIC_NAV_LABEL_OVERRIDES[item.href] ?? item.label
          : category === 'EVENT_VENUE' && item.href === '/dashboard/programari'
            ? 'Rezervări'
            : category === 'EVENT_VENUE' && item.href === '/dashboard/servicii'
              ? 'Săli'
              : item.label,
    }))
    .concat(isSuperAdmin ? [{ href: '/superadmin', label: 'Super Admin', badge: undefined, icon: 'superadmin' }] : [])

  return (
    <ResponsiveShell
      logoHref="/dashboard"
      logoLabel="Pontifix"
      profileName={businessName ?? undefined}
      navItems={navItems}
      accentColor={brandColor ?? undefined}
      accountContent={<SidebarUserBlock label={userEmail || 'Cont'} showSupport />}
      enableLiveBadges
    >
      {children}
    </ResponsiveShell>
  )
}
