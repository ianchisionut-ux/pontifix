'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Building2, FilePlus2, FileText, LayoutDashboard, Package, Users, UserRoundCog } from 'lucide-react'
import { CurrentUserBox } from './CurrentUserBox'

const items = [
  { href: '/dashboard/contabilitate', label: 'Panou', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/contabilitate/invoices', label: 'Facturi', icon: FileText },
  { href: '/dashboard/contabilitate/invoices/new', label: 'Factură nouă', icon: FilePlus2 },
  { href: '/dashboard/contabilitate/clients', label: 'Clienți', icon: Users },
  { href: '/dashboard/contabilitate/products', label: 'Produse', icon: Package },
  { href: '/dashboard/contabilitate/users', label: 'Emitenți', icon: UserRoundCog },
  { href: '/dashboard/contabilitate/reports', label: 'Rapoarte', icon: BarChart3 },
  { href: '/dashboard/contabilitate/company', label: 'Firma', icon: Building2 },
]

export function AccountingNav() {
  const pathname = usePathname()
  return (
    <div className="accounting-toolbar screen-only">
      <nav className="accounting-nav">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
          return <Link key={href} href={href} className={active ? 'active' : ''}><Icon size={15}/><span>{label}</span></Link>
        })}
      </nav>
      <CurrentUserBox />
    </div>
  )
}