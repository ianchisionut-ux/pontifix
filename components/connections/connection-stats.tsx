import Link from 'next/link'
import { Activity, Cable, CheckCircle2, ClipboardCheck } from 'lucide-react'
import { CONNECTION_STATUS_META, type ConnectionStatus } from '@/lib/connection-status'

export type ConnectionStatsData = { total: number; active: number; completed: number; approved: number; averageProgress: number; byStatus: Array<{ status: ConnectionStatus; count: number }> }

export function ConnectionStats({ data, compact = false }: { data: ConnectionStatsData; compact?: boolean }) {
  const cards = [
    ['Branșamente', data.total, Cable], ['Dosare aprobate', data.approved, ClipboardCheck],
    ['În desfășurare', data.active, Activity], ['Finalizate', data.completed, CheckCircle2],
  ] as const
  return <section className={compact ? 'mt-6' : 'mt-8'}>
    <div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-semibold">Statistici branșamente</h2><p className="text-sm text-slate-500">Situația dosarelor identificate prin NIB.</p></div><Link href="/dashboard/bransamente" className="text-sm font-semibold text-blue-600">Deschide branșamentele →</Link></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon]) => <div className="card p-5" key={label}><div className="flex justify-between"><p className="text-sm text-slate-500">{label}</p><Icon size={18} className="text-[#197fb5]"/></div><p className="mt-3 text-3xl font-semibold">{value}</p></div>)}</div>
    <div className="card mt-4 p-5"><div className="flex items-center justify-between"><p className="font-semibold text-[#082b4d]">Progres mediu</p><strong className="text-[#197fb5]">{data.averageProgress}%</strong></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#197fb5] to-emerald-500" style={{ width: `${data.averageProgress}%` }}/></div><div className="mt-5 flex flex-wrap gap-3">{data.byStatus.map((item) => <span key={item.status} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CONNECTION_STATUS_META[item.status].color }}/>{CONNECTION_STATUS_META[item.status].label}: {item.count}</span>)}</div></div>
  </section>
}
