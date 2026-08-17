import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SidebarUserBlock } from '@/components/sidebar-user-block'
import { ResponsiveShell } from '@/components/responsive-shell'

export const dynamic = 'force-dynamic'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Prezentare', icon: 'overview' },
  { href: '/dashboard/oferte', label: 'Oferte', icon: 'inbox' },
  { href: '/dashboard/proiecte', label: 'Proiecte', icon: 'proiecte' },
  { href: '/dashboard/bransamente', label: 'Branșamente', icon: 'bransamente' },
  { href: '/dashboard/formulare', label: 'Formulare', icon: 'formulare' },
  { href: '/dashboard/mesaje', label: 'Mesaje', icon: 'mesaje' },
  { href: '/dashboard/chat-intern', label: 'Chat intern', icon: 'chat-intern' },
  { href: '/dashboard/rapoarte', label: 'Rapoarte', icon: 'statistici' },
  { href: '/dashboard/pontaje', label: 'Pontaje', icon: 'calendar' },
  { href: '/dashboard/angajati', label: 'Angajați', icon: 'clienti' },
  { href: '/dashboard/concedii', label: 'Concedii', icon: 'programari' },
  { href: '/dashboard/configurare', label: 'Configurare', icon: 'setari' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/superadmin')
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, brandColor: true } })
  return <ResponsiveShell logoHref="/dashboard" logoLabel="Elmont" profileName={business?.name ?? 'Compania mea'} navItems={NAV_ITEMS} accentColor={'#197fb5'} accountContent={<SidebarUserBlock label={session.user?.email ?? 'Cont'} />} enableLiveBadges>
    {children}
  </ResponsiveShell>
}
