'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type ProjectProgress = { id: string; name: string; progress: number }

export function ProjectProgressOverview({ projects }: { projects: ProjectProgress[] }) {
  const chart = projects.slice(0, 8).map((project) => ({
    ...project,
    shortName: project.name.length > 22 ? `${project.name.slice(0, 22)}…` : project.name,
  }))

  return <section className="card p-5 lg:p-6 mt-5">
    <div className="flex items-center justify-between gap-4 mb-4">
      <div><h2 className="font-semibold">Stadiul proiectelor</h2><p className="text-sm text-slate-500">Avize 70% · Autorizația de construire 30%</p></div>
      <Link href="/dashboard/proiecte" className="btn-secondary inline-flex items-center gap-2">Deschide proiectele <ArrowUpRight size={15}/></Link>
    </div>
    {chart.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="shortName" fontSize={10} interval={0}/><YAxis domain={[0,100]} unit="%" fontSize={10}/><Tooltip formatter={(value) => [`${value}%`, 'Stadiu fizic']} labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}/><Bar dataKey="progress" fill="#2563eb" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></div> : <div className="py-12 text-center text-sm text-slate-400">Nu există încă proiecte active.</div>}
  </section>
}
