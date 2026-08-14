import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureProjectAuthorizationStorage } from '@/lib/ensure-project-authorization-storage'
import { redirect } from 'next/navigation'
import { ReportCharts } from '@/components/attendance/report-charts'
import { ProjectReportCharts } from '@/components/projects/project-report-charts'
import { formatHours } from '@/lib/attendance'
import { ConnectionStats } from '@/components/connections/connection-stats'
import { getConnectionStatistics } from '@/lib/connection-statistics'
import { BarChart3, Building2, CheckCircle2, Clock, FileCheck2, TrendingUp, TriangleAlert, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

function stageScore(status: string) { return status === 'OBTAINED' ? 1 : status === 'SUBMITTED' ? 0.5 : 0 }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) redirect('/login')

  const connectionStats = await getConnectionStatistics(businessId)
  const requestedDays = Number((await searchParams).days || 30)
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30
  const today = new Date()
  const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const startDate = new Date(endDate)
  startDate.setUTCDate(startDate.getUTCDate() - days + 1)

  await ensureProjectAuthorizationStorage()
  const [entries, employees, projects] = await Promise.all([
    prisma.dailyAttendance.findMany({ where: { businessId, workDate: { gte: startDate, lte: endDate } }, include: { employee: true }, orderBy: { workDate: 'asc' } }),
    prisma.attendanceEmployee.findMany({ where: { businessId, active: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    prisma.project.findMany({ where: { businessId }, include: { approvals: true }, orderBy: { createdAt: 'desc' } }),
  ])

  const totalMinutes = Math.round(entries.reduce((sum, entry) => sum + entry.hours * 60, 0))
  const overtimeMinutes = Math.round(entries.reduce((sum, entry) => sum + Math.max(0, entry.hours - entry.employee.dailyHours) * 60, 0))
  const employeesWithHours = new Set(entries.filter((entry) => entry.hours > 0).map((entry) => entry.employeeId)).size
  const dailyMap = new Map<string, number>()
  for (let index = 0; index < days; index++) { const date = new Date(startDate); date.setUTCDate(startDate.getUTCDate() + index); dailyMap.set(date.toISOString().slice(0, 10), 0) }
  for (const entry of entries) { const key = entry.workDate.toISOString().slice(0, 10); dailyMap.set(key, (dailyMap.get(key) || 0) + entry.hours) }
  const daily = [...dailyMap].map(([date, hours]) => ({ day: new Date(`${date}T12:00:00Z`).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }), hours: Number(hours.toFixed(1)) }))

  const departmentMap = new Map<string, number>()
  for (const employee of employees) departmentMap.set(employee.department || (employee.category === 'TESA' ? 'TESA' : 'Producție'), 0)
  for (const entry of entries) { const department = entry.employee.department || (entry.employee.category === 'TESA' ? 'TESA' : 'Producție'); departmentMap.set(department, (departmentMap.get(department) || 0) + entry.hours) }
  const departments = [...departmentMap].map(([name, hours]) => ({ name, hours: Number(hours.toFixed(1)) }))

  const todayEntries = entries.filter((entry) => entry.workDate.getTime() === endDate.getTime())
  const presentToday = new Set(todayEntries.filter((entry) => entry.status === 'PRESENT' || entry.status === 'REMOTE').map((entry) => entry.employeeId)).size
  const vacationToday = new Set(todayEntries.filter((entry) => entry.status === 'VACATION').map((entry) => entry.employeeId)).size
  const medicalToday = new Set(todayEntries.filter((entry) => entry.status === 'MEDICAL').map((entry) => entry.employeeId)).size
  const unavailableToday = new Set(todayEntries.filter((entry) => entry.status === 'ABSENT' || entry.status === 'DAY_OFF').map((entry) => entry.employeeId)).size
  const unmarkedToday = Math.max(0, employees.length - presentToday - vacationToday - medicalToday - unavailableToday)
  const employeeCards = [['Ore lucrate',formatHours(totalMinutes),Clock],['Medie / angajat pontat',employeesWithHours?formatHours(Math.round(totalMinutes/employeesWithHours)):'0h',TrendingUp],['Angajați activi',String(employees.length),Users],['Ore suplimentare',formatHours(overtimeMinutes),TriangleAlert]] as const

  const projectData = projects.filter((project) => project.status !== 'ARCHIVED').map((project) => {
    const approvals = project.approvals.length ? project.approvals.reduce((sum, approval) => sum + stageScore(approval.status), 0) / project.approvals.length : 0
    return { id: project.id, name: project.name, updatedAt: project.updatedAt.toISOString(), progress: Math.round(approvals * 70 + stageScore(project.constructionAuthorizationStatus) * 30), authorizationStatus: project.constructionAuthorizationStatus }
  })
  const allApprovals = projects.flatMap((project) => project.approvals)
  const averageProgress = projectData.length ? Math.round(projectData.reduce((sum, project) => sum + project.progress, 0) / projectData.length) : 0
  const projectCards = [['Proiecte în lucru',String(projects.filter(project=>project.status==='ACTIVE').length),Building2],['Progres mediu',`${averageProgress}%`,BarChart3],['Avize depuse',String(allApprovals.filter(approval=>approval.status==='SUBMITTED').length),FileCheck2],['Avize obținute',String(allApprovals.filter(approval=>approval.status==='OBTAINED').length),CheckCircle2]] as const
  const projectStatuses = [{name:'În lucru',value:projects.filter(project=>project.status==='ACTIVE').length,color:'#197fb5'},{name:'În așteptare',value:projects.filter(project=>project.status==='ON_HOLD').length,color:'#f59e0b'},{name:'Finalizate',value:projects.filter(project=>project.status==='COMPLETED').length,color:'#22c55e'},{name:'Arhivate',value:projects.filter(project=>project.status==='ARCHIVED').length,color:'#94a3b8'}]

  return <div className="w-full p-4 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6"><div><h1 className="text-2xl font-semibold">Statistici</h1><p className="text-sm text-slate-500 mt-1">Angajați, pontaje și proiecte într-o singură vedere.</p></div><div className="flex items-center gap-2"><div className="bg-white border rounded-xl p-1 text-sm">{[7,30,90].map(value=><Link key={value} href={`/dashboard/rapoarte?days=${value}`} className={`inline-block px-3 py-1.5 rounded-lg ${days===value?'bg-blue-600 text-white':'text-slate-600 hover:bg-slate-50'}`}>{value} zile</Link>)}</div><a className="btn-secondary" href={`/api/attendance/export?days=${days}`}>Export CSV</a></div></div>
    <h2 className="text-lg font-semibold mb-3">Statistici angajați</h2>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">{employeeCards.map(([label,value,Icon])=><div className="card p-5" key={label}><div className="flex justify-between"><p className="text-sm text-slate-500">{label}</p><Icon size={18} className="text-blue-600"/></div><p className="text-3xl font-semibold mt-3">{value}</p><p className="text-xs text-slate-400 mt-2">ultimele {days} zile</p></div>)}</div>
    <ReportCharts days={days} daily={daily} presence={[{name:'Prezenți azi',value:presentToday,color:'#22c55e'},{name:'Nemarcați azi',value:unmarkedToday,color:'#f59e0b'},{name:'Concediu',value:vacationToday,color:'#49a6d4'},{name:'Medical / liber',value:medicalToday+unavailableToday,color:'#ef4444'}]} departments={departments}/>
    <div className="mt-8 mb-3 flex items-end justify-between"><div><h2 className="text-lg font-semibold">Statistici proiecte</h2><p className="text-sm text-slate-500">Situația actuală a proiectelor și avizelor.</p></div><Link href="/dashboard/proiecte" className="text-sm font-semibold text-blue-600">Deschide proiectele →</Link></div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">{projectCards.map(([label,value,Icon])=><div className="card p-5" key={label}><div className="flex justify-between"><p className="text-sm text-slate-500">{label}</p><Icon size={18} className="text-blue-600"/></div><p className="text-3xl font-semibold mt-3">{value}</p><p className="text-xs text-slate-400 mt-2">situația curentă</p></div>)}</div>
    <ProjectReportCharts projects={projectData} statuses={projectStatuses}/>
    <ConnectionStats data={connectionStats}/>
  </div>
}
