'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ProjectProgressList, type ProgressProject } from '@/components/projects/project-progress-list'

type StatusPoint = { name: string; value: number; color: string }

export function ProjectReportCharts({ projects, statuses }: { projects: ProgressProject[]; statuses: StatusPoint[] }) {
  const total = statuses.reduce((sum, status) => sum + status.value, 0)
  const averageProgress = projects.length ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length) : 0
  const authorizationSubmitted = projects.filter((project) => project.authorizationStatus === 'SUBMITTED').length
  const authorizationObtained = projects.filter((project) => project.authorizationStatus === 'OBTAINED').length

  return <div className="grid gap-4">
    <section className="card min-h-[360px] w-full p-5 lg:p-6">
      <div className="mb-5"><h3 className="font-semibold">Progres pe proiect</h3><p className="text-sm text-slate-500">Denumirile și stadiile actuale din secțiunea Proiecte.</p></div>
      <ProjectProgressList projects={projects}/>
    </section>

    <section className="card w-full p-5 lg:p-6">
      <div><h3 className="font-semibold">Distribuția proiectelor</h3><p className="text-sm text-slate-500">Starea, progresul și autorizațiile proiectelor active.</p></div>
      <div className="mt-5 grid items-center gap-6 lg:grid-cols-[.8fr_1fr_.8fr]">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Metric label="Total proiecte" value={total}/>
          <Metric label="În lucru" value={statuses.find((status) => status.name.includes('lucru'))?.value || 0}/>
          <Metric label="În așteptare" value={statuses.find((status) => status.name.includes('așteptare'))?.value || 0}/>
        </div>
        <div><div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statuses} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2}>{statuses.map((status) => <Cell key={status.name} fill={status.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-2">{statuses.map((status) => <div key={status.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-500"><i className="h-2 w-2 rounded-full" style={{ background: status.color }}/>{status.name}</span><b>{status.value}</b></div>)}</div></div>
        <div className="space-y-3">
          <div className="rounded-2xl bg-[#edf7fc] p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-600">Progres mediu</span><b className="text-xl text-[#0d5d8b]">{averageProgress}%</b></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-gradient-to-r from-[#197fb5] to-emerald-500" style={{ width: `${averageProgress}%` }}/></div></div>
          <Metric label="Autorizații depuse" value={authorizationSubmitted}/>
          <Metric label="Autorizații obținute" value={authorizationObtained}/>
          <Metric label="Proiecte finalizate" value={statuses.find((status) => status.name === 'Finalizate')?.value || 0}/>
        </div>
      </div>
    </section>
  </div>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-[#082b4d]">{value}</p></div>
}