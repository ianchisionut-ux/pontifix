'use client'

import { useState } from 'react'
import { Building2, CalendarClock, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

const DAYS = [
  { value: 1, label: 'Luni' }, { value: 2, label: 'Marți' }, { value: 3, label: 'Miercuri' },
  { value: 4, label: 'Joi' }, { value: 5, label: 'Vineri' }, { value: 6, label: 'Sâmbătă' }, { value: 0, label: 'Duminică' },
]

export function AttendanceSettingsForm({ companyName, weekdays, startTime, endTime, breakStart, breakEnd }: {
  companyName: string
  weekdays: number[]
  startTime: string
  endTime: string
  breakStart: string
  breakEnd: string
}) {
  const router = useRouter()
  const [days, setDays] = useState(weekdays)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function toggleDay(day: number) {
    setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])
  }

  async function submit(formData: FormData) {
    setBusy(true); setSaved(false); setError('')
    const response = await fetch('/api/attendance/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...Object.fromEntries(formData), weekdays: days }),
    })
    setBusy(false)
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Setările nu au putut fi salvate.' }))
      return setError(data.error || 'Setările nu au putut fi salvate.')
    }
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2500)
  }

  return <form action={submit} className="grid gap-5">
    <section className="card p-6">
      <div className="flex items-center gap-3 mb-5"><span className="settings-icon"><Building2 size={19}/></span><div><h2 className="font-semibold">Organizație</h2><p className="text-sm text-slate-500">Denumirea afișată în rapoarte și pe foaia tipărită.</p></div></div>
      <label className="text-sm font-medium block max-w-lg">Denumire<input name="companyName" className="input-field w-full mt-2 h-11" defaultValue={companyName} required/></label>
    </section>

    <section className="card p-6">
      <div className="flex items-center gap-3 mb-5"><span className="settings-icon"><CalendarClock size={19}/></span><div><h2 className="font-semibold">Program standard</h2><p className="text-sm text-slate-500">Programul pornește automat la ora setată. Nu este necesară pornirea manuală.</p></div></div>
      <div className="flex flex-wrap gap-2 mb-5">{DAYS.map((day) => <button type="button" key={day.value} onClick={() => toggleDay(day.value)} className={`workday-chip ${days.includes(day.value) ? 'selected' : ''}`}>{days.includes(day.value) && <Check size={13}/>} {day.label}</button>)}</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-sm font-medium">Început<input name="startTime" className="input-field w-full mt-2" type="time" defaultValue={startTime} required/></label>
        <label className="text-sm font-medium">Sfârșit<input name="endTime" className="input-field w-full mt-2" type="time" defaultValue={endTime} required/></label>
        <label className="text-sm font-medium">Început pauză<input name="breakStart" className="input-field w-full mt-2" type="time" defaultValue={breakStart}/></label>
        <label className="text-sm font-medium">Sfârșit pauză<input name="breakEnd" className="input-field w-full mt-2" type="time" defaultValue={breakEnd}/></label>
      </div>
      <p className="text-xs text-slate-400 mt-4">Orele standard din foaia de prezență sunt calculate din acest interval, minus pauza.</p>
    </section>

    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="flex justify-end"><button className="btn-primary min-w-40" disabled={busy || days.length === 0}>{busy ? 'Se salvează...' : saved ? 'Salvat ✓' : 'Salvează setările'}</button></div>
  </form>
}
