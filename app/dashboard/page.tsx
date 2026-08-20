import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { WorkScheduleCard } from '@/components/attendance/work-schedule-card'
import { formatHours } from '@/lib/attendance'
import { Users, UserCheck, Timer, CalendarOff, ArrowUpRight } from 'lucide-react'
import { ProjectProgressOverview } from '@/components/projects/project-progress-overview'
import { ConnectionStats } from '@/components/connections/connection-stats'
import { getConnectionStatistics } from '@/lib/connection-statistics'

export const dynamic = 'force-dynamic'

function bucharestDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { date: new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00.000Z`), weekday: weekdays[get('weekday')] }
}

export default async function DashboardPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) redirect('/login')

  const now = new Date()
  const local = bucharestDate(now)
  const startMonth = new Date(Date.UTC(local.date.getUTCFullYear(), local.date.getUTCMonth(), 1))
  const endMonth = new Date(Date.UTC(local.date.getUTCFullYear(), local.date.getUTCMonth() + 1, 1))
  const [connectionStats, employees, todayEntries, monthHours, pendingLeaves, business, projects] = await Promise.all([
    getConnectionStatistics(businessId),
    prisma.attendanceEmployee.count({ where: { businessId, active: true } }),
    prisma.dailyAttendance.findMany({ where: { businessId, workDate: local.date }, include: { employee: true }, orderBy: { employee: { lastName: 'asc' } } }),
    prisma.dailyAttendance.aggregate({ where: { businessId, workDate: { gte: startMonth, lt: endMonth } }, _sum: { hours: true } }),
    prisma.leaveRequest.count({ where: { businessId, status: 'PENDING' } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { break1Start: true, break1End: true, workingHours: true } }),
    prisma.project.findMany({ where: { businessId, status: { not: 'ARCHIVED' } }, select: { id: true, name: true, updatedAt: true, constructionAuthorizationStatus: true, approvals: { select: { status: true } } }, orderBy: { createdAt: 'desc' } }),
  ])
  const presentEntries = todayEntries.filter((entry) => entry.status === 'PRESENT' || entry.status === 'REMOTE')
  const present = presentEntries.length
  const monthMinutes = Math.round((monthHours._sum.hours || 0) * 60)
  const todaySchedule = business?.workingHours.find((item) => item.weekday === local.weekday)
  const defaultSchedule = business?.workingHours[0]
  const schedule = todaySchedule ?? defaultSchedule
  const projectProgress = projects.map((project) => {
    const approvalScore = project.approvals.length ? project.approvals.reduce((sum, approval) => sum + (approval.status === 'OBTAINED' ? 1 : approval.status === 'SUBMITTED' ? 0.5 : 0), 0) / project.approvals.length : 0
    const authorizationScore = project.constructionAuthorizationStatus === 'OBTAINED' ? 1 : project.constructionAuthorizationStatus === 'SUBMITTED' ? 0.5 : 0
    return { id: project.id, name: project.name, updatedAt: project.updatedAt.toISOString(), progress: Math.round(approvalScore * 70 + authorizationScore * 30), authorizationStatus: project.constructionAuthorizationStatus }
  })
  const stats = [
    { label: 'Angajați activi', value: employees, hint: 'în organizație', icon: Users, color: 'text-blue-600' },
    { label: 'Prezenți astăzi', value: present, hint: `${Math.max(0, employees - present)} fără prezență marcată`, icon: UserCheck, color: 'text-emerald-600' },
    { label: 'Ore luna aceasta', value: formatHours(monthMinutes), hint: 'total din foaia colectivă', icon: Timer, color: 'text-blue-600' },
    { label: 'Cereri concediu', value: pendingLeaves, hint: 'necesită aprobare', icon: CalendarOff, color: 'text-amber-600' },
  ]
  return <div className="p-4 lg:p-8 max-w-[1500px] mx-auto">
    <div className="flex items-end justify-between gap-4 mb-7"><div><p className="text-sm text-slate-500">{now.toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1 className="text-3xl font-semibold tracking-tight mt-1">Bun venit în Elmont</h1></div><a href="/dashboard/pontaje" className="btn-secondary hidden sm:inline-flex items-center gap-2">Deschide foaia de prezență <ArrowUpRight size={16}/></a></div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">{stats.map((item) => <div key={item.label} className="card p-5"><div className="flex justify-between"><p className="text-sm text-slate-500">{item.label}</p><item.icon size={19} className={item.color}/></div><p className="text-3xl font-semibold mt-3 tracking-tight">{item.value}</p><p className="text-xs text-slate-400 mt-2">{item.hint}</p></div>)}</div>
    <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-5">
      <WorkScheduleCard startTime={schedule?.startTime ?? '09:00'} endTime={schedule?.endTime ?? '17:30'} breakStart={business?.break1Start ?? null} breakEnd={business?.break1End ?? null} isWorkday={!!todaySchedule || (business?.workingHours.length === 0 && local.weekday >= 1 && local.weekday <= 5)}/>
      <section className="card p-5 lg:p-6"><div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold">Prezența zilei</h2><p className="text-sm text-slate-500">Conform foii completate de administrator</p></div><span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">{present} prezenți</span></div><div className="space-y-3">{todayEntries.slice(0, 8).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-semibold">{entry.employee.firstName[0]}{entry.employee.lastName[0]}</div><div><p className="text-sm font-medium">{entry.employee.firstName} {entry.employee.lastName}</p><p className="text-xs text-slate-400">{entry.employee.position || 'Angajat'}</p></div></div><div className="text-right"><p className="text-sm font-semibold tabular-nums">{entry.hours ? `${entry.hours}h` : entry.status === 'VACATION' ? 'Concediu' : entry.status === 'MEDICAL' ? 'Medical' : entry.status === 'DAY_OFF' ? 'Liber' : entry.status === 'ABSENT' ? 'Absent' : 'Distanță'}</p></div></div>)}{todayEntries.length === 0 && <div className="py-10 text-center"><p className="text-sm text-slate-400">Prezența nu a fost completată astăzi.</p><a href="/dashboard/pontaje" className="text-sm text-blue-600 font-semibold inline-block mt-2">Completează foaia →</a></div>}</div></section>
    </div>
    <ProjectProgressOverview projects={projectProgress}/>
    <ConnectionStats data={connectionStats} compact/>
  </div>
}
