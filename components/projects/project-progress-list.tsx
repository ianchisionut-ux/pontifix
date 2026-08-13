'use client'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type AuthorizationStatus = 'REQUIRED' | 'SUBMITTED' | 'OBTAINED' | 'NOT_REQUIRED'
export type ProgressProject = { id: string; name: string; progress: number; authorizationStatus: AuthorizationStatus; updatedAt?: string }

function color(project: ProgressProject) {
  if (project.authorizationStatus === 'OBTAINED') return '#16a34a'
  if (project.authorizationStatus === 'SUBMITTED') return '#197fb5'
  const hue = Math.round(Math.max(0, Math.min(70, project.progress)) * 0.65)
  return `hsl(${hue} 82% 50%)`
}

function state(project: ProgressProject) {
  if (project.authorizationStatus === 'OBTAINED') return 'Finalizat'
  if (project.authorizationStatus === 'SUBMITTED') return 'Autorizație depusă'
  return 'Avize în lucru'
}

function shortName(name: string) {
  return name.length > 24 ? `…${name.slice(-24)}` : name
}

export function ProjectProgressList({ projects, limit }: { projects: ProgressProject[]; limit?: number }) {
  const rows = (typeof limit === 'number' ? projects.slice(0, limit) : projects).map((project) => ({
    ...project,
    shortName: shortName(project.name),
    progress: Math.max(0, Math.min(100, project.progress)),
  }))

  if (!rows.length) return <div className="flex h-52 items-center justify-center text-sm text-slate-400">Nu există proiecte.</div>

  const chartWidth = Math.max(760, rows.length * 112)
  const chartSignature = rows
    .map((project) => `${project.id}:${project.name}:${project.updatedAt ?? ''}:${project.progress}`)
    .join('|')

  return <div className="w-full overflow-x-auto pb-2">
    <div key={chartSignature} style={{ width: chartWidth, height: 350 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 24, bottom: 62, left: 6 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            type="category"
            dataKey="shortName"
            interval={0}
            height={66}
            tick={{ fontSize: 10, fill: '#475569' }}
            angle={-28}
            textAnchor="end"
          />
          <YAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const project = payload[0].payload as ProgressProject
              return <div className="max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
                <p className="whitespace-normal break-words text-xs font-semibold text-slate-900">{project.name}</p>
                <p className="mt-1 text-xs text-slate-500">Stadiu fizic: <b className="text-slate-800">{project.progress}%</b></p>
                <p className="mt-0.5 text-[11px] font-medium" style={{ color: color(project) }}>{state(project)}</p>
              </div>
            }}
          />
          <Bar dataKey="progress" radius={[7, 7, 0, 0]} maxBarSize={44}>
            {rows.map((project) => <Cell key={project.id} fill={color(project)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
}
