import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { ProjectProgressList } from '@/components/projects/project-progress-list'

type ProjectProgress = { id: string; name: string; progress: number; authorizationStatus: 'REQUIRED' | 'SUBMITTED' | 'OBTAINED' | 'NOT_REQUIRED' }

export function ProjectProgressOverview({ projects }: { projects: ProjectProgress[] }) {
  return <section className="card p-5 lg:p-6 mt-5">
    <div className="flex items-center justify-between gap-4 mb-4"><div><h2 className="font-semibold">Stadiul fizic al proiectelor</h2><p className="text-sm text-slate-500">Albastru = autorizație depusă · verde cu bifă = proiect finalizat</p></div><Link href="/dashboard/proiecte" className="btn-secondary inline-flex items-center gap-2">Deschide proiectele <ArrowUpRight size={15}/></Link></div>
    {projects.length?<ProjectProgressList projects={projects} limit={8}/>:<div className="py-12 text-center text-sm text-slate-400">Nu există încă proiecte active.</div>}
  </section>
}
