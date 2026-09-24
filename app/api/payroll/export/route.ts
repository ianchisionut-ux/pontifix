import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getPayroll } from '@/lib/payroll'

const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`

export async function GET(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId || (session as any)?.role === 'STAFF') return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const month = req.nextUrl.searchParams.get('month') || ''
  const run = await getPayroll(businessId, month)
  if (!run) return NextResponse.json({ error: 'Statul nu există.' }, { status: 404 })
  const headers = ['Nume','Prenume','CNP','Funcție','Zile lucrate','CO','CM','Ore','Ore suplimentare','Salariu bază','Brut','CAS','CASS','Deducere personală','Bază impozabilă','Impozit','Avans','Alte rețineri','Net de plată','Tichete','CAM','Cost angajator','Sursă']
  const rows = run.lines.map((line) => [line.employee.lastName,line.employee.firstName,line.employee.cnp||'',line.employee.position||'',line.workedDays,line.vacationDays,line.medicalDays,line.workedHours,line.overtimeHours,line.baseGross,line.grossIncome,line.cas,line.cass,line.personalDeduction,line.taxableBase,line.incomeTax,line.advancePaid,line.otherDeductions,line.netSalary,line.mealTickets,line.cam,line.employerCost,line.source])
  const body = '\uFEFF' + [headers,...rows].map((row) => row.map(csv).join(';')).join('\r\n')
  return new NextResponse(body, { headers: { 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':`attachment; filename="stat-salarii-${month}.csv"` } })
}
