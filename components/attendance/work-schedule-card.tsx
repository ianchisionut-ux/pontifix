'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, Coffee, Timer } from 'lucide-react'
import Link from 'next/link'

function minutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

export function WorkScheduleCard({ startTime, endTime, breakStart, breakEnd, isWorkday }: {
  startTime: string
  endTime: string
  breakStart: string | null
  breakEnd: string | null
  isWorkday: boolean
}) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const current = now.getHours() * 60 + now.getMinutes()
  const start = minutes(startTime)
  const end = minutes(endTime)
  const breakFrom = breakStart ? minutes(breakStart) * 60 : null
  const breakTo = breakEnd ? minutes(breakEnd) * 60 : null
  const totalBreak = breakFrom !== null && breakTo !== null ? Math.max(0, breakTo - breakFrom) : 0
  const elapsedRaw = Math.max(0, Math.min(current, end) - start)
  const elapsedBreak = breakFrom !== null && breakTo !== null ? Math.max(0, Math.min(current, breakTo) - breakFrom) : 0
  const elapsed = isWorkday ? Math.max(0, elapsedRaw - elapsedBreak) : 0
  const total = Math.max(0, end - start - totalBreak)
  const progress = total ? Math.min(100, Math.round(elapsed / total * 100)) : 0
  const elapsedHours = Math.floor(elapsed / 3600)
  const elapsedMinutes = Math.floor((elapsed % 3600) / 60)
  const elapsedSeconds = elapsed % 60
  const isBreak = isWorkday && breakFrom !== null && breakTo !== null && current >= breakFrom && current < breakTo
  const state = !isWorkday ? 'Zi nelucrătoare' : current < start ? `Începe la ${startTime}` : current >= end ? 'Program încheiat' : isBreak ? 'Pauză în desfășurare' : 'Program în desfășurare'

  return <section className="schedule-card">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-blue-200 text-sm">{now.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}</p><p className="text-4xl lg:text-5xl font-semibold tracking-tight tabular-nums mt-2">{now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</p></div>
      <CalendarClock className="text-blue-300" size={29}/>
    </div>
    <div className="mt-7">
      <div className="flex items-end justify-between gap-4"><div><p className="text-sm text-blue-200/75">{state}</p><p className="text-2xl font-semibold tabular-nums mt-1">{String(elapsedHours).padStart(2, '0')}:{String(elapsedMinutes).padStart(2, '0')}:{String(elapsedSeconds).padStart(2, '0')}</p></div><Link href="/dashboard/configurare" className="schedule-edit-link">Editează programul</Link></div>
      <div className="schedule-progress mt-5"><span style={{ width: `${progress}%` }}/></div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-xs text-blue-100/70"><span className="inline-flex items-center gap-1.5"><Timer size={14}/>{startTime}–{endTime}</span>{breakStart && breakEnd && <span className="inline-flex items-center gap-1.5"><Coffee size={14}/>Pauză {breakStart}–{breakEnd}</span>}</div>
    </div>
  </section>
}
