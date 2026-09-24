import './accounting.css'
import { requireAccountingPage } from '@/lib/accounting/access'
import { AccountingNav } from '@/components/accounting/AccountingNav'

export const dynamic = 'force-dynamic'

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  await requireAccountingPage()
  return (
    <div className="accounting-root">
      <div className="accounting-heading">
        <div>
          <span>Administrare financiară</span>
          <h1>Contabilitate</h1>
          <p>Facturare, contabilitate în partidă dublă, rapoarte și declarații într-un singur loc.</p>
        </div>
      </div>
      <AccountingNav />
      <div className="accounting-content">{children}</div>
    </div>
  )
}
