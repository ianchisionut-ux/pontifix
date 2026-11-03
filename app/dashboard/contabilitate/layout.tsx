import './accounting.css'
import { requireAccountingPage } from '@/lib/accounting/access'
import { AccountingNav } from '@/components/accounting/AccountingNav'

export const dynamic = 'force-dynamic'

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  await requireAccountingPage()
  return (
    <div className="accounting-root">
      <div className="accounting-heading">
        <span>Administrare financiară</span><h1>Contabilitate</h1>
      </div>
      <AccountingNav />
      <div className="accounting-content">{children}</div>
    </div>
  )
}
