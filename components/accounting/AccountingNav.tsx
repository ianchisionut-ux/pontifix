'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, BookOpenCheck, Building2, CloudCog, ContactRound, FilePlus2, FileSpreadsheet, FileText, Landmark, LayoutDashboard, Package, ShoppingCart, Users, UserRoundCog, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CurrentUserBox } from './CurrentUserBox'

const root = '/dashboard/contabilitate'
type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean }

const billingItems: NavItem[] = [
  { href: root, label: 'Panou facturare', icon: LayoutDashboard, exact: true },
  { href: `${root}/invoices`, label: 'Facturi emise', icon: FileText },
  { href: `${root}/invoices/new`, label: 'Factură nouă', icon: FilePlus2, exact: true },
  { href: `${root}/clients`, label: 'Clienți', icon: Users },
  { href: `${root}/products`, label: 'Produse', icon: Package },
  { href: `${root}/users`, label: 'Emitenți', icon: UserRoundCog },
  { href: `${root}/efactura`, label: 'e-Factura', icon: CloudCog },
  { href: `${root}/integrations`, label: 'Integrări instituții', icon: CloudCog },
  { href: `${root}/reports`, label: 'Rapoarte vânzări', icon: BarChart3 },
]

const accountingItems: NavItem[] = [
  { href: `${root}/ledger`, label: 'Jurnal contabil', icon: Landmark },
  { href: `${root}/purchases`, label: 'Intrări / achiziții', icon: ShoppingCart },
  { href: `${root}/registers`, label: 'Casă / bancă', icon: WalletCards },
  { href: `${root}/suppliers`, label: 'Furnizori', icon: ContactRound },
  { href: `${root}/ref`, label: 'Registru fiscal', icon: BookOpenCheck },
  { href: `${root}/declarations`, label: 'Declarații ANAF', icon: FileSpreadsheet },
]

function isActive(pathname: string, href: string, exact = false) {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`))
}

export function AccountingNav() {
  const pathname = usePathname()
  const isCompany = isActive(pathname, `${root}/company`)
  const isAccounting = accountingItems.some(({ href }) => isActive(pathname, href))
  const activeZone = isAccounting ? 'accounting' : 'billing'

  function renderItems(items: NavItem[]) {
    return items.map(({ href, label, icon: Icon, exact }) => {
      const active = isActive(pathname, href, exact) && !(href === `${root}/invoices` && pathname === `${root}/invoices/new`)
      return <Link key={href} href={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} title={label}><Icon size={16} aria-hidden="true"/><span>{label}</span></Link>
    })
  }

  return (
    <div className="accounting-navigation screen-only">
      <div className="accounting-toolbar">
        <div className="accounting-zone-switch" aria-label="Alege zona">
          <Link href={root} className={activeZone === 'billing' && !isCompany ? 'active' : ''}>Facturare</Link>
          <Link href={`${root}/ledger`} className={activeZone === 'accounting' && !isCompany ? 'active' : ''}>Contabilitate</Link>
        </div>
        <div className={`accounting-nav-group accounting-nav-group-billing ${activeZone === 'billing' ? 'zone-active' : ''}`}>
          <span className="accounting-nav-group-title">Facturare</span>
          <nav className="accounting-nav" aria-label="Funcții de facturare">{renderItems(billingItems)}</nav>
        </div>
        <div className={`accounting-nav-group accounting-nav-group-bookkeeping ${activeZone === 'accounting' ? 'zone-active' : ''}`}>
          <span className="accounting-nav-group-title">Contabilitate</span>
          <nav className="accounting-nav" aria-label="Funcții de contabilitate">{renderItems(accountingItems)}</nav>
        </div>
        <div className="accounting-toolbar-actions">
          <Link href={`${root}/company`} className={`accounting-shared-link ${isCompany ? 'active' : ''}`} aria-current={isCompany ? 'page' : undefined}><Building2 size={16} aria-hidden="true"/> Firma</Link>
          <CurrentUserBox />
        </div>
      </div>
    </div>
  )
}
