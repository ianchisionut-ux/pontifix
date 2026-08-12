'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import type { AdvancedPeriodStats, AnalyticsPeriod } from '@/lib/statsHelper'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, CalendarDays, Download, Gauge, RefreshCw, Users } from 'lucide-react'

type Category = 'SALON' | 'EVENT_VENUE' | 'HOTEL' | 'PENSIUNE' | 'CLINICA'
type PeriodData = AdvancedPeriodStats & { bookingChange: number; revenueChange: number }
type Analytics = { periods: Record<AnalyticsPeriod, PeriodData>; rating: number; reviewCount: number }

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 7, label: '7 zile' }, { value: 30, label: '30 zile' }, { value: 90, label: '90 zile' }, { value: 365, label: '1 an' },
]
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'În așteptare', CONFIRMED: 'Confirmate', COMPLETED: 'Finalizate', NO_SHOW: 'Neprezentări', CANCELLED: 'Anulate',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#E8B84A', CONFIRMED: '#36A269', COMPLETED: '#5B7CFA', NO_SHOW: '#8B6FD6', CANCELLED: '#E16B6B',
}
const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', GOOGLE_BUSINESS: 'Google', WEB: 'Site', MANUAL: 'Manual',
}

function money(value: number) {
  return `${Math.round(value).toLocaleString('ro-RO')} lei`
}

function Delta({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-700' : 'text-red-600'}`}>
      {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(value).toFixed(0)}%
    </span>
  )
}

function KpiCard({ label, value, hint, delta, icon }: { label: string; value: string; hint?: string; delta?: number; icon?: React.ReactNode }) {
  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-xl lg:text-2xl font-semibold mt-1 truncate">{value}</p>
        </div>
        {icon && <span className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">{icon}</span>}
      </div>
      <div className="mt-2 min-h-4 flex items-center gap-1.5">
        {delta !== undefined && <Delta value={delta} />}
        {hint && <span className="text-[11px] text-gray-400 truncate">{hint}</span>}
      </div>
    </Card>
  )
}

export default function StatisticiCharts({ analytics, category }: { analytics: Analytics; category: Category }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>(30)
  const [metric, setMetric] = useState<'bookings' | 'revenue'>('bookings')
  const data = analytics.periods[period]
  const isClinic = category === 'CLINICA'
  const isVenue = category === 'EVENT_VENUE'
  const isAppointmentBased = category === 'SALON' || category === 'CLINICA'
  const bookingLabel = isAppointmentBased ? 'Programări' : 'Rezervări'
  const operatorLabel = isVenue ? 'Performanță pe sală' : isClinic ? 'Performanță pe medic' : 'Performanță pe membru'
  const statusData = data.byStatus.filter((item) => item.count > 0)

  const insights = useMemo(() => {
    const peakHour = data.byHour.reduce((best, item) => item.count > best.count ? item : best, data.byHour[0])
    const peakDay = data.byDayOfWeek.reduce((best, item) => item.count > best.count ? item : best, data.byDayOfWeek[0])
    const topChannel = data.byChannel[0]
    return [
      peakDay?.count ? `${peakDay.label} este cea mai solicitată zi, cu ${peakDay.count} ${bookingLabel.toLowerCase()}.` : 'Nu sunt încă suficiente date pentru ziua de vârf.',
      peakHour?.count ? `Intervalul de vârf începe la ${String(peakHour.hour).padStart(2, '0')}:00.` : 'Ora de vârf va apărea după primele rezervări.',
      topChannel ? `${CHANNEL_LABEL[topChannel.name] ?? topChannel.name} aduce cele mai multe solicitări (${topChannel.count}).` : 'Canalele de achiziție vor fi comparate automat.',
    ]
  }, [data, bookingLabel])

  function exportCsv() {
    const rows = [['Data', bookingLabel, 'Venit', 'Anulate'], ...data.daily.map((row) => [row.date, row.bookings, row.revenue, row.cancelled])]
    const csv = rows.map((row) => row.join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    link.download = `bookeasy-statistici-${period}-zile.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="p-4 lg:p-8 max-w-[1500px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold mb-1">Statistici</h1>
          <p className="text-sm text-gray-500">Performanță, {isClinic ? 'pacienți' : 'clienți'} și grad de ocupare într-o singură vedere.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--border-soft)] bg-white p-1">
            {PERIODS.map((item) => (
              <button key={item.value} onClick={() => setPeriod(item.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${period === item.value ? 'bg-[var(--accent)] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>{item.label}</button>
            ))}
          </div>
          <button onClick={exportCsv} className="btn-secondary text-xs flex items-center gap-1.5"><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <KpiCard label={bookingLabel} value={String(data.totalBookings)} delta={data.bookingChange} hint="față de perioada anterioară" icon={<CalendarDays size={17} />} />
        <KpiCard label="Venit estimat" value={money(data.revenue)} delta={data.revenueChange} hint="față de perioada anterioară" />
        <KpiCard label="Valoare medie" value={money(data.avgBookingValue)} hint={`per ${isAppointmentBased ? 'programare' : 'rezervare'}`} />
        <KpiCard label="Grad de ocupare" value={`${(data.utilizationRate * 100).toFixed(0)}%`} hint="din capacitatea disponibilă" icon={<Gauge size={17} />} />
        <KpiCard label={isClinic ? 'Pacienți unici' : 'Clienți unici'} value={String(data.uniqueCustomers)} hint={`${data.newCustomers} noi`} icon={<Users size={17} />} />
        <KpiCard label={isClinic ? 'Pacienți reveniți' : 'Clienți reveniți'} value={String(data.returningCustomers)} hint={data.uniqueCustomers ? `${((data.returningCustomers / data.uniqueCustomers) * 100).toFixed(0)}% din total` : 'fără date'} icon={<RefreshCw size={16} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-4 mb-5">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div><h2 className="font-medium">Evoluție în timp</h2><p className="text-xs text-gray-500">Treci cu mouse-ul peste grafic pentru valori exacte.</p></div>
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              <button onClick={() => setMetric('bookings')} className={`px-2.5 py-1 rounded-md text-xs ${metric === 'bookings' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>{bookingLabel}</button>
              <button onClick={() => setMetric('revenue')} className={`px-2.5 py-1 rounded-md text-xs ${metric === 'revenue' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>Venit</button>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={data.daily}>
                <defs><linearGradient id="statFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent)" stopOpacity={0.28}/><stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(value) => value.slice(5)} minTickGap={24} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={45} tickFormatter={(value) => metric === 'revenue' && value >= 1000 ? `${Math.round(value / 1000)}k` : value} />
                <Tooltip formatter={(value) => metric === 'revenue' ? money(Number(value)) : [Number(value), bookingLabel]} labelFormatter={(value) => new Date(`${value}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })} />
                <Area type="monotone" dataKey={metric} stroke="var(--accent)" strokeWidth={2.5} fill="url(#statFill)" activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="font-medium">Starea {bookingLabel.toLowerCase()}</h2>
          <p className="text-xs text-gray-500 mb-2">Distribuția tuturor solicitărilor din perioadă.</p>
          <div className="h-52">
            {statusData.length ? <ResponsiveContainer><PieChart><Pie data={statusData} dataKey="count" nameKey="status" innerRadius={55} outerRadius={82} paddingAngle={2}>{statusData.map((item) => <Cell key={item.status} fill={STATUS_COLOR[item.status]} />)}</Pie><Tooltip formatter={(value, _name, item) => [Number(value), STATUS_LABEL[item.payload.status]]} /></PieChart></ResponsiveContainer> : <div className="h-full flex items-center justify-center text-sm text-gray-400">Fără date încă</div>}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {statusData.map((item) => <div key={item.status} className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-gray-500"><i className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[item.status] }} />{STATUS_LABEL[item.status]}</span><strong>{item.count}</strong></div>)}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <h2 className="font-medium mb-1">Cerere pe ore</h2><p className="text-xs text-gray-500 mb-3">Identifică intervalele care au cea mai mare cerere.</p>
          <div className="h-52"><ResponsiveContainer><BarChart data={data.byHour}><XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(hour) => `${String(hour).padStart(2, '0')}:00`} interval={2}/><YAxis tick={{ fontSize: 10 }} allowDecimals={false}/><Tooltip labelFormatter={(hour) => `Ora ${String(hour).padStart(2, '0')}:00`} /><Bar dataKey="count" name={bookingLabel} fill="#5DCAA5" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
        </Card>
        <Card>
          <h2 className="font-medium mb-1">Cerere pe zile</h2><p className="text-xs text-gray-500 mb-3">Distribuția medie în cursul săptămânii.</p>
          <div className="h-52"><ResponsiveContainer><BarChart data={data.byDayOfWeek}><XAxis dataKey="label" tick={{ fontSize: 10 }} tickFormatter={(label) => label.slice(0,3)}/><YAxis tick={{ fontSize: 10 }} allowDecimals={false}/><Tooltip/><Bar dataKey="count" name={bookingLabel} fill="var(--accent)" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <RankingCard title="Top servicii" rows={data.topServices} empty="Serviciile vor apărea după primele rezervări." />
        <RankingCard title="Canale de achiziție" rows={data.byChannel.map((row) => ({ ...row, name: CHANNEL_LABEL[row.name] ?? row.name }))} empty="Fără date pe canale." />
        <RankingCard title={operatorLabel} rows={data.byOperator} empty={isVenue ? 'Sălile rezervate vor apărea aici.' : 'Disponibil pentru profilurile cu echipă.'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <Card>
          <h2 className="font-medium mb-3">Observații automate</h2>
          <div className="grid sm:grid-cols-3 gap-3">{insights.map((text, index) => <div key={index} className="rounded-xl bg-gray-50 border border-[var(--border-soft)] p-3 text-sm text-gray-600">{text}</div>)}</div>
        </Card>
        <Card>
          <h2 className="font-medium mb-3">Calitatea operațională</h2>
          <MetricRow label="Finalizate" value={data.completionRate} good />
          <MetricRow label="Anulate" value={data.cancellationRate} />
          <MetricRow label="Neprezentări" value={data.noShowRate} />
          {analytics.reviewCount > 0 && <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-[var(--border-soft)]">Scor recenzii: <strong className="text-gray-900">{analytics.rating.toFixed(1)}/5</strong> din {analytics.reviewCount} recenzii</p>}
        </Card>
      </div>
    </div>
  )
}

function RankingCard({ title, rows, empty }: { title: string; rows: { name: string; count: number; revenue: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.count))
  return <Card><h2 className="font-medium mb-3">{title}</h2>{rows.length ? <div className="space-y-3">{rows.map((row) => <div key={row.name}><div className="flex justify-between gap-3 text-xs mb-1"><span className="truncate text-gray-600">{row.name}</span><strong className="whitespace-nowrap">{row.count} · {money(row.revenue)}</strong></div><div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(row.count / max) * 100}%` }} /></div></div>)}</div> : <p className="text-sm text-gray-400">{empty}</p>}</Card>
}

function MetricRow({ label, value, good = false }: { label: string; value: number; good?: boolean }) {
  return <div className="mb-3"><div className="flex justify-between text-xs mb-1"><span className="text-gray-500">{label}</span><strong>{(value * 100).toFixed(0)}%</strong></div><div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${good ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, value * 100)}%` }} /></div></div>
}
