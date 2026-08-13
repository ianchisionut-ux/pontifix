'use client'

import { CheckCircle2, FileClock } from 'lucide-react'

type AuthorizationStatus = 'REQUIRED' | 'SUBMITTED' | 'OBTAINED' | 'NOT_REQUIRED'
type ProgressProject = { id: string; name: string; progress: number; authorizationStatus: AuthorizationStatus }

function color(project: ProgressProject) {
  if (project.authorizationStatus === 'OBTAINED') return '#16a34a'
  if (project.authorizationStatus === 'SUBMITTED') return '#2563eb'
  const hue = Math.round(Math.max(0, Math.min(70, project.progress)) * 0.65)
  return `hsl(${hue} 82% 50%)`
}

function state(project: ProgressProject) {
  if (project.authorizationStatus === 'OBTAINED') return 'Finalizat'
  if (project.authorizationStatus === 'SUBMITTED') return 'Autorizație depusă'
  return 'Avize în lucru'
}

export function ProjectProgressList({ projects, limit }: { projects: ProgressProject[]; limit?: number }) {
  const rows = typeof limit === 'number' ? projects.slice(0, limit) : projects
  return <div className="grid lg:grid-cols-2 gap-x-6 gap-y-3">
    {rows.map((project) => <div key={project.id} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-slate-800 leading-snug break-words" title={project.name}>{project.name}</p><div className="shrink-0 flex items-center gap-1.5" style={{color:color(project)}}>{project.authorizationStatus==='OBTAINED'?<CheckCircle2 size={15}/>:project.authorizationStatus==='SUBMITTED'?<FileClock size={15}/>:null}<strong className="text-sm tabular-nums">{project.progress}%</strong></div></div>
      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{width:`${project.progress}%`,background:color(project)}}/></div>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{color:color(project)}}>{state(project)}</p>
    </div>)}
  </div>
}
