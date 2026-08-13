'use client'

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type ProjectPoint = { id: string; name: string; progress: number; authorizationStatus: 'REQUIRED' | 'SUBMITTED' | 'OBTAINED' | 'NOT_REQUIRED' }
type StatusPoint = { name: string; value: number; color: string }

function progressColor(project: ProjectPoint) {
  if (project.authorizationStatus === 'OBTAINED') return '#16a34a'
  if (project.authorizationStatus === 'SUBMITTED') return '#2563eb'
  const hue = Math.round(Math.max(0, Math.min(70, project.progress)) * 0.65)
  return 'hsl(' + hue + ' 82% 50%)'
}

export function ProjectReportCharts({ projects, statuses }: { projects: ProjectPoint[]; statuses: StatusPoint[] }) {
  const data = projects.map((project) => ({
    ...project,
    shortName: project.name.length > 26 ? `${project.name.slice(0, 26)}…` : project.name,
    progress: Math.max(0, Math.min(100, project.progress)),
  }))

  return <div className="grid xl:grid-cols-[1.35fr_.65fr] gap-4">
    <section className="card p-5 lg:p-6 min-h-[360px]">
      <div className="mb-5">
        <h3 className="font-semibold">Progres pe proiect</h3>
        <p className="text-sm text-slate-500">Roșu la început, galben în lucru, albastru la depunere și verde la finalizare.</p>
      </div>
      {data.length ? <div style={{ height: Math.max(270, data.length * 42) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} unit="%" fontSize={10} />
            <YAxis type="category" dataKey="shortName" width={170} interval={0} fontSize={10} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const project = payload[0].payload as ProjectPoint
                return <div className="max-w-sm rounded-xl border bg-white px-3 py-2 shadow-lg">
                  <p className="whitespace-normal break-words text-xs font-semibold">{project.name}</p>
                  <p className="mt-1 text-xs text-slate-500">Stadiu fizic: <b>{project.progress}%</b></p>
                </div>
              }}
            />
            <Bar dataKey="progress" radius={[0, 7, 7, 0]} maxBarSize={24}>
              {data.map((project) => <Cell key={project.id} fill={progressColor(project)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div> : <div className="flex h-[270px] items-center justify-center text-sm text-slate-400">Nu există proiecte.</div>}
    </section>

    <section className="card p-5 lg:p-6 min-h-[360px]">
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
