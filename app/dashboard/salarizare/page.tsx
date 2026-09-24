import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPayroll } from '@/lib/payroll'
import { PayrollWorkspace } from '@/components/payroll/payroll-workspace'

export const dynamic = 'force-dynamic'

export default async function PayrollPage({ searchParams }:{ searchParams:Promise<{month?:string}> }) {
  const session=await auth()
  const businessId=(session as any)?.businessId as string|undefined
  if(!businessId)redirect('/login')
  if((session as any)?.role==='STAFF')redirect('/dashboard')
  const params=await searchParams
  const month=/^\d{4}-(0[1-9]|1[0-2])$/.test(params.month||'')?params.month!:new Date().toISOString().slice(0,7)
  const run=await getPayroll(businessId,month)
  return <div className="p-3 lg:p-6 w-full max-w-none"><PayrollWorkspace key={month} initialRun={run} initialMonth={month}/></div>
}
