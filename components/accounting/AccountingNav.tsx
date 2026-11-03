'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, BookOpenCheck, Building2, CloudCog, ContactRound, FilePlus2, FileSpreadsheet, FileText, Landmark, WalletCards, LayoutDashboard, Package, ShoppingCart, Users, UserRoundCog } from 'lucide-react'
import { CurrentUserBox } from './CurrentUserBox'

const items = [
  { href: '/dashboard/contabilitate', label: 'Panou', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/contabilitate/invoices', label: 'Ieșiri / facturi', icon: FileText },
  { href: '/dashboard/contabilitate/invoices/new', label: 'Factură nouă', icon: FilePlus2 },
  { href: '/dashboard/contabilitate/ledger', label: 'Contabilitate', icon: Landmark },
  { href: '/dashboard/contabilitate/purchases', label: 'Intrări / achiziții', icon: ShoppingCart },
  { href: '/dashboard/contabilitate/registers', label: 'Casă / bancă', icon: WalletCards },
  { href: '/dashboard/contabilitate/suppliers', label: 'Furnizori', icon: ContactRound },
  { href: '/dashboard/contabilitate/clients', label: 'Clienți', icon: Users },
  { href: '/dashboard/contabilitate/products', label: 'Produse', icon: Package },
  { href: '/dashboard/contabilitate/users', label: 'Emitenți', icon: UserRoundCog },
  { href: '/dashboard/contabilitate/reports', label: 'Rapoarte', icon: BarChart3 },
  { href: '/dashboard/contabilitate/ref', label: 'Registru fiscal', icon: BookOpenCheck },
  { href: '/dashboard/contabilitate/efactura', label: 'e-Factura', icon: CloudCog },
  { href: '/dashboard/contabilitate/declarations', label: 'Declarații ANAF', icon: FileSpreadsheet },
  { href: '/dashboard/contabilitate/company', label: 'Firma', icon: Building2 },
]

export function AccountingNav() {
  const pathname = usePathname()
  const primary = items.slice(0, 9)
  const secondary = items.slice(9)
  const renderLink = ({ href, label, icon: Icon, exact }: typeof items[number]) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
    return <Link key={href} href={href} className={active ? 'active' : ''}><Icon size={14}/><span>{label}</span></Link>
  }
  return (
    <div className="accounting-toolbar screen-only">
      <div className="accounting-nav-row"><nav className="accounting-nav" aria-label="Contabilitate - navigare principală">{primary.map(renderLink)}</nav><CurrentUserBox /></div>
      <nav className="accounting-nav accounting-nav-secondary" aria-label="Contabilitate - alte secțiuni">{secondary.map(renderLink)}</nav>
    </div>
  )
}
