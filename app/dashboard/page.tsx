import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { ClockCard } from '@/components/attendance/clock-card'
import { formatHours, getOrCreateEmployeeForUser, workedMinutes } from '@/lib/attendance'
import { Users, UserCheck, Timer, CalendarOff, ArrowUpRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const userId = (session as any)?.userId as string | undefined
  if (!businessId || !userId) redirect('/login')
  const employee = await getOrCreateEmployeeForUser(userId, businessId, session?.user?.email ?? '')
  const now = new Date()
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const [employees, todayEntries, monthEntries, pendingLeaves, openEntry] = await Promise.all([
    prisma.attendanceEmployee.count({ where: { businessId, active: true } }),
    prisma.timeEntry.findMany({ where: { businessId, clockIn: { gte: startToday } }, include: { employee: true }, orderBy: { clockIn: 'desc' } }),
    prisma.timeEntry.findMany({ where: { businessId, clockIn: { gte: startMonth } } }),
    prisma.leaveRequest.count({ where: { businessId, status: 'PENDING' } }),
    prisma.timeEntry.findFirst({ where: { employeeId: employee.id, clockOut: null }, orderBy: { clockIn: 'desc' } }),
  ])
  const present = new Set(todayEntries.map(e => e.employeeId)).size
  const monthMinutes = monthEntries.reduce((sum, e) => sum + workedMinutes(e.clockIn, e.clockOut, e.breakMinutes), 0)
  const stats = [
    { label: 'Angajați activi', value: employees, hint: 'în organizație', icon: Users, tone: 'violet' },
    { label: 'Prezenți astăzi', value: present, hint: `${Math.max(0, employees - present)} încă nepontați`, icon: UserCheck, tone: 'emerald' },
    { label: 'Ore luna aceasta', value: formatHours(monthMinutes), hint: 'total echipă', icon: Timer, tone: 'blue' },
    { label: 'Cereri concediu', value: pendingLeaves, hint: 'necesită aprobare', icon: CalendarOff, tone: 'amber' },
  ]
  return <div className="p-4 lg:p-8 max-w-[1500px] mx-auto">
    <div className="flex items-end justify-between gap-4 mb-7"><div><p className="text-sm text-slate-500">{now.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1 className="text-3xl font-semibold tracking-tight mt-1">Bun venit în Pontifix</h1></div><a href="/dashboard/rapoarte" className="btn-secondary hidden sm:inline-flex items-center gap-2">Vezi rapoarte <ArrowUpRight size={16}/></a></div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">{stats.map(s => <div key={s.label} className="card p-5"><div className="flex justify-between"><p className="text-sm text-slate-500">{s.label}</p><s.icon size={19} className={`text-${s.tone}-500`}/></div><p className="text-3xl font-semibold mt-3 tracking-tight">{s.value}</p><p className="text-xs text-slate-400 mt-2">{s.hint}</p></div>)}</div>
    <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-5"><ClockCard activeSince={openEntry?.clockIn.toISOString() ?? null}/><section className="card p-5 lg:p-6"><div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold">Prezență în timp real</h2><p className="text-sm text-slate-500">Ultimele pontări de astăzi</p></div><span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">{present} prezenți</span></div><div className="space-y-3">{todayEntries.slice(0, 6).map(entry => <div key={entry.id} className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-semibold">{entry.employee.firstName[0]}{entry.employee.lastName[0]}</div><div><p className="text-sm font-medium">{entry.employee.firstName} {entry.employee.lastName}</p><p className="text-xs text-slate-400">{entry.employee.position || 'Angajat'}</p></div></div><div className="text-right"><p className="text-sm tabular-nums">{entry.clockIn.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</p><p className={`text-xs ${entry.clockOut ? 'text-slate-400' : 'text-emerald-600'}`}>{entry.clockOut ? 'Ieșit' : 'La lucru'}</p></div></div>)}{todayEntries.length === 0 && <p className="text-sm text-slate-400 py-10 text-center">Nicio pontare înregistrată astăzi.</p>}</div></section></div>
  </div>
}