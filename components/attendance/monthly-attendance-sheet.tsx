'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, X, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Status = 'PRESENT' | 'ABSENT' | 'VACATION' | 'MEDICAL' | 'DAY_OFF' | 'REMOTE'
type Employee = { id: string; firstName: string; lastName: string; position: string | null }
type Entry = { id?: string; employeeId: string; workDate: string; status: Status; hours: number; note: string | null }

const STATUS: Record<Status, { label: string; short: string; className: string }> = {
  PRESENT: { label: 'Prezent', short: 'P', className: 'attendance-present' },
  REMOTE: { label: 'Lucru la distanță', short: 'D', className: 'attendance-remote' },
  VACATION: { label: 'Concediu de odihnă', short: 'C', className: 'attendance-vacation' },
  MEDICAL: { label: 'Concediu medical', short: 'M', className: 'attendance-medical' },
  DAY_OFF: { label: 'Zi liberă', short: 'L', className: 'attendance-off' },
  ABSENT: { label: 'Absent', short: 'A', className: 'attendance-absent' },
}

const MONTHS = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function MonthlyAttendanceSheet({ employees, initialEntries, year, month, companyName }: {
  employees: Employee[]
  initialEntries: Entry[]
  year: number
  month: number
  companyName: string
}) {
  const router = useRouter()
  const [entries, setEntries] = useState<Record<string, Entry>>(() => Object.fromEntries(initialEntries.map((entry) => [`${entry.employeeId}:${entry.workDate.slice(0, 10)}`, entry])))
  const [editor, setEditor] = useState<{ employee: Employee; day: number } | null>(null)
  const [status, setStatus] = useState<Status>('PRESENT')
  const [hours, setHours] = useState('8')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const days = new Date(year, month, 0).getDate()

  const totals = useMemo(() => Object.fromEntries(employees.map((employee) => {
    const employeeEntries = Object.values(entries).filter((entry) => entry.employeeId === employee.id)
    return [employee.id, {
      hours: employeeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0),
      present: employeeEntries.filter((entry) => entry.status === 'PRESENT' || entry.status === 'REMOTE').length,
      leave: employeeEntries.filter((entry) => entry.status === 'VACATION' || entry.status === 'MEDICAL').length,
    }]
  })), [employees, entries])

  function changeMonth(offset: number) {
    const next = new Date(year, month - 1 + offset, 1)
    router.push(`/dashboard/pontaje?month=${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }

  function openEditor(employee: Employee, day: number) {
    const key = `${employee.id}:${dateKey(year, month, day)}`
    const existing = entries[key]
    setEditor({ employee, day })
    setStatus(existing?.status ?? 'PRESENT')
    setHours(String(existing?.hours ?? 8))
    setNote(existing?.note ?? '')
  }

  function handleCellClick(employee: Employee, day: number) {
    if (clickTimer.current) clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => openEditor(employee, day), 230)
  }

  async function quickPresent(employee: Employee, day: number) {
    if (clickTimer.current) clearTimeout(clickTimer.current)
    setEditor(null)
    const date = dateKey(year, month, day)
    const key = `${employee.id}:${date}`
    const previous = entries[key]
    const nextEntry: Entry = { employeeId: employee.id, workDate: date, status: 'PRESENT', hours: 8, note: null }
    setEntries((current) => ({ ...current, [key]: nextEntry }))
    try {
      const response = await fetch('/api/attendance/daily', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, date, status: 'PRESENT', hours: 8, note: '' }),
      })
      if (!response.ok) throw new Error('save failed')
    } catch {
      setEntries((current) => {
        const restored = { ...current }
        if (previous) restored[key] = previous
        else delete restored[key]
        return restored
      })
      alert('Pontajul nu a putut fi salvat.')
    }
  }

  async function save(nextStatus: Status | null) {
    if (!editor) return
    setSaving(true)
    const date = dateKey(year, month, editor.day)
    const response = await fetch('/api/attendance/daily', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: editor.employee.id, date, status: nextStatus, hours: Number(hours) || 0, note }),
    })
    setSaving(false)
    if (!response.ok) return alert('Pontajul nu a putut fi salvat.')
    const key = `${editor.employee.id}:${date}`
    setEntries((current) => {
      const next = { ...current }
      if (!nextStatus) delete next[key]
      else next[key] = { employeeId: editor.employee.id, workDate: date, status: nextStatus, hours: nextStatus === 'PRESENT' || nextStatus === 'REMOTE' ? Number(hours) || 0 : 0, note: note || null }
      return next
    })
    setEditor(null)
  }

  return (
    <div className="attendance-page">
      <div className="attendance-toolbar no-print">
        <div>
          <h1 className="text-2xl font-semibold">Foaie colectivă de prezență</h1>
          <p className="text-sm text-slate-500 mt-1">Click simplu pentru alegerea stării · dublu-click pentru Prezent, 8 ore.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="attendance-month-picker">
            <button onClick={() => changeMonth(-1)} aria-label="Luna anterioară"><ChevronLeft size={17}/></button>
            <strong>{MONTHS[month - 1]} {year}</strong>
            <button onClick={() => changeMonth(1)} aria-label="Luna următoare"><ChevronRight size={17}/></button>
          </div>
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => window.print()}><Printer size={17}/> Printează / PDF</button>
        </div>
      </div>

      <section className="attendance-paper">
      <div className="attendance-print-heading">
        <h1>FOAIE COLECTIVĂ DE PREZENȚĂ</h1>
        <p>{companyName} · {MONTHS[month - 1]} {year}</p>
      </div>

      <div className="attendance-legend no-print">
        {Object.entries(STATUS).map(([key, value]) => <span key={key}><b className={value.className}>{value.short}</b> {value.label}</span>)}
      </div>

      <div className="card attendance-sheet-wrap">
        <table className="attendance-sheet">
          <thead>
            <tr>
              <th className="attendance-nr">Nr.</th>
              <th className="attendance-name">Nume și prenume</th>
              {Array.from({ length: days }, (_, index) => {
                const day = index + 1
                const weekday = new Date(year, month - 1, day).getDay()
                return <th key={day} className={weekday === 0 || weekday === 6 ? 'is-weekend' : ''}><span>{day}</span><small>{['D','L','M','M','J','V','S'][weekday]}</small></th>
              })}
              <th className="attendance-total">Ore</th>
              <th className="attendance-total">P</th>
              <th className="attendance-total">C</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, index) => (
              <tr key={employee.id}>
                <td className="attendance-nr">{index + 1}</td>
                <th className="attendance-name"><span>{employee.lastName.toUpperCase()} {employee.firstName}</span><small>{employee.position || 'Angajat'}</small></th>
                {Array.from({ length: days }, (_, dayIndex) => {
                  const day = dayIndex + 1
                  const date = dateKey(year, month, day)
                  const entry = entries[`${employee.id}:${date}`]
                  const weekday = new Date(year, month - 1, day).getDay()
                  const display = entry ? (entry.status === 'PRESENT' || entry.status === 'REMOTE' ? String(entry.hours).replace('.5', '½') : STATUS[entry.status].short) : ''
                  return <td key={day} className={weekday === 0 || weekday === 6 ? 'is-weekend' : ''}><button className={entry ? STATUS[entry.status].className : ''} onClick={() => handleCellClick(employee, day)} onDoubleClick={() => quickPresent(employee, day)} title={entry ? `${STATUS[entry.status].label} · click pentru editare · dublu-click = Prezent 8h` : 'Click pentru alegere · dublu-click = Prezent 8h'}>{display}</button></td>
                })}
                <td className="attendance-total">{totals[employee.id].hours || ''}</td>
                <td className="attendance-total">{totals[employee.id].present || ''}</td>
                <td className="attendance-total">{totals[employee.id].leave || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && <p className="p-10 text-center text-slate-400">Adaugă angajați pentru a începe pontajul.</p>}
      </div>

      <div className="attendance-signatures">
        <span>Întocmit de: ____________________</span>
        <span>Verificat: ____________________</span>
        <span>Semnătură: ____________________</span>
      </div>
      </section>

      {editor && <div className="fixed inset-0 z-50 bg-slate-950/35 flex items-center justify-center p-4 no-print" onMouseDown={() => setEditor(null)}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex justify-between gap-4">
            <div><h2 className="text-xl font-semibold">{editor.employee.firstName} {editor.employee.lastName}</h2><p className="text-sm text-slate-500 mt-1">{editor.day} {MONTHS[month - 1]} {year}</p></div>
            <button onClick={() => setEditor(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X size={17}/></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
            {(Object.keys(STATUS) as Status[]).map((value) => <button key={value} onClick={() => setStatus(value)} className={`attendance-status-choice ${status === value ? 'selected' : ''}`}><b className={STATUS[value].className}>{STATUS[value].short}</b><span>{STATUS[value].label}</span>{status === value && <Check size={15}/>}</button>)}
          </div>
          {(status === 'PRESENT' || status === 'REMOTE') && <label className="block mt-4 text-sm font-medium">Ore lucrate<input className="input-field w-full mt-1.5" type="number" min="0" max="24" step="0.5" value={hours} onChange={(event) => setHours(event.target.value)}/></label>}
          <label className="block mt-3 text-sm font-medium">Notă opțională<input className="input-field w-full mt-1.5" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex: tură de dimineață"/></label>
          <div className="flex items-center justify-between gap-2 mt-6">
            <button className="text-sm text-red-600 px-2 py-2" disabled={saving} onClick={() => save(null)}>Șterge pontajul</button>
            <button className="btn-primary" disabled={saving} onClick={() => save(status)}>{saving ? 'Se salvează...' : 'Salvează'}</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
