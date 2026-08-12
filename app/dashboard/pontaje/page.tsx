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
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true, break1Start: true, break1End: true, workingHours: { orderBy: { weekday: 'asc' } } } }),
    prisma.attendanceEmployee.findMany({ where: { businessId, active: true }, orderBy: [{ category: 'desc' }, { sortOrder: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }], select: { id: true, firstName: true, lastName: true, position: true, dailyHours: true, category: true, sortOrder: true } }),
    prisma.dailyAttendance.findMany({ where: { businessId, workDate: { gte: start, lt: end } }, select: { id: true, employeeId: true, workDate: true, status: true, hours: true, note: true } }),
  ])

  const schedule = business?.workingHours[0]
  const toMinutes = (value?: string | null) => {
    if (!value) return 0
    const [hours, minutes] = value.split(':').map(Number)
    return hours * 60 + minutes
  }
  const breakMinutes = business?.break1Start && business?.break1End ? Math.max(0, toMinutes(business.break1End) - toMinutes(business.break1Start)) : 0
  const standardHours = schedule ? Math.max(0.5, (toMinutes(schedule.endTime) - toMinutes(schedule.startTime) - breakMinutes) / 60) : 8

  return <div className="p-3 lg:p-5 w-full max-w-none">
    <MonthlyAttendanceSheet
      employees={employees}
      initialEntries={entries.map((entry) => ({ ...entry, status: entry.status === 'REMOTE' ? 'PRESENT' as const : entry.status, workDate: entry.workDate.toISOString().slice(0, 10) }))}
      year={year}
      month={month}
      companyName={business?.name ?? 'Pontifix'}
      standardHours={standardHours}
    />
  </div>
}
