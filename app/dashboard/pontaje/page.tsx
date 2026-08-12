import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { MonthlyAttendanceSheet } from '@/components/attendance/monthly-attendance-sheet'

export const dynamic = 'force-dynamic'

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) redirect('/login')

  const params = await searchParams
  const requested = /^\d{4}-\d{2}$/.test(params.month || '') ? params.month! : new Date().toISOString().slice(0, 7)
  const [year, month] = requested.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))

  const [business, employees, entries] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    prisma.attendanceEmployee.findMany({ where: { businessId, active: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], select: { id: true, firstName: true, lastName: true, position: true } }),
    prisma.dailyAttendance.findMany({ where: { businessId, workDate: { gte: start, lt: end } }, select: { id: true, employeeId: true, workDate: true, status: true, hours: true, note: true } }),
  ])

  return <div className="p-3 lg:p-6 max-w-[1800px] mx-auto">
    <MonthlyAttendanceSheet
      employees={employees}
      initialEntries={entries.map((entry) => ({ ...entry, workDate: entry.workDate.toISOString().slice(0, 10) }))}
      year={year}
      month={month}
      companyName={business?.name ?? 'Pontifix'}
    />
  </div>
}
