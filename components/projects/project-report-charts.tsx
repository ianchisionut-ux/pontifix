'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ProjectProgressList, type ProgressProject } from '@/components/projects/project-progress-list'

type StatusPoint = { name: string; value: number; color: string }

export function ProjectReportCharts({ projects, statuses }: { projects: ProgressProject[]; statuses: StatusPoint[] }) {
  return <div className="grid gap-4">
    <section className="card p-5 lg:p-6 min-h-[360px] w-full">
      <div className="mb-5">
        <h3 className="font-semibold">Progres pe proiect</h3>
        <p className="text-sm text-slate-500">Denumirile și stadiile actuale din secțiunea Proiecte.</p>
      </div>
      <ProjectProgressList projects={projects} />
    </section>

    <section className="card p-5 lg:p-6 min-h-[360px] w-full">
      <div>
        <h3 className="font-semibold">Distribuția proiectelor</h3>
        <p className="text-sm text-slate-500">După starea curentă.</p>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={statuses} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2}>
              {statuses.map((status) => <Cell key={status.name} fill={status.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {statuses.map((status) => <div key={status.name} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-500"><i className="h-2 w-2 rounded-full" style={{ background: status.color }} />{status.name}</span>
          <b>{status.value}</b>
        </div>)}
      </div>
    </section>
  </div>
}
