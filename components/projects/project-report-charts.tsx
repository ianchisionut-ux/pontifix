'use client'

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type ProjectPoint = { id: string; name: string; progress: number }
type StatusPoint = { name: string; value: number; color: string }

function progressColor(progress: number) {
  if (progress >= 100) return '#16a34a'
  const hue = Math.round(Math.max(0, Math.min(99, progress)) * 0.55)
  return 'hsl(' + hue + ' 82% 50%)'
}

export function ProjectReportCharts({ projects, statuses }: { projects: ProjectPoint[]; statuses: StatusPoint[] }) {
  const data = projects.map((project) => ({ ...project, shortName: project.name.length > 18 ? `${project.name.slice(0, 18)}…` : project.name }))
  return <div className="grid xl:grid-cols-[1.35fr_.65fr] gap-4">
    <section className="card p-5 lg:p-6 min-h-[360px]"><div className="mb-5"><h3 className="font-semibold">Progres pe proiect</h3><p className="text-sm text-slate-500">Roșu la început, galben în lucru și verde la finalizare.</p></div>{data.length?<div className="h-[270px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="shortName" fontSize={10}/><YAxis domain={[0,100]} unit="%" fontSize={10}/><Tooltip content={({active,payload})=>active&&payload?.length?<div className="rounded-xl border bg-white px-3 py-2 shadow-lg max-w-sm"><p className="text-xs font-semibold whitespace-normal">{payload[0].payload.name}</p><p className="text-xs text-slate-500 mt-1">Stadiu fizic: <b>{payload[0].value}%</b></p></div>:null}/><Bar dataKey="progress" radius={[7,7,0,0]}>{data.map(project=><Cell key={project.id} fill={progressColor(project.progress)}/>)}</Bar></BarChart></ResponsiveContainer></div>:<div className="h-[270px] flex items-center justify-center text-sm text-slate-400">Nu există proiecte.</div>}</section>
    <section className="card p-5 lg:p-6 min-h-[360px]"><div><h3 className="font-semibold">Distribuția proiectelor</h3><p className="text-sm text-slate-500">După starea curentă.</p></div><div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statuses} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2}>{statuses.map(status=><Cell key={status.name} fill={status.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-2">{statuses.map(status=><div key={status.name} className="flex items-center justify-between text-sm"><span className="text-slate-500 flex items-center gap-2"><i className="w-2 h-2 rounded-full" style={{background:status.color}}/>{status.name}</span><b>{status.value}</b></div>)}</div></section>
  </div>
}
