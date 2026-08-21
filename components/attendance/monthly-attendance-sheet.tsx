'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, Eraser, GripVertical, MousePointer2, Printer, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Status = 'PRESENT' | 'ABSENT' | 'VACATION' | 'MEDICAL' | 'DAY_OFF'
type Tool = 'EDIT' | 'COPY' | 'ERASE' | Status
type Category = 'TESA' | 'PRODUCTIE'
type Employee = { id: string; firstName: string; lastName: string; position: string | null; dailyHours: number; category: Category; sortOrder: number }
type Entry = { id?: string; employeeId: string; workDate: string; status: Status; hours: number; note: string | null }

const STATUS: Record<Status, { label: string; short: string; className: string }> = {
  PRESENT: { label: 'Prezent', short: 'P', className: 'attendance-present' },
  VACATION: { label: 'Concediu', short: 'C', className: 'attendance-vacation' },
  MEDICAL: { label: 'Medical', short: 'M', className: 'attendance-medical' },
  DAY_OFF: { label: 'Liber', short: 'L', className: 'attendance-off' },
  ABSENT: { label: 'Absent', short: 'A', className: 'attendance-absent' },
}
const GROUPS: Category[] = ['TESA', 'PRODUCTIE']
const MONTHS = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']

function dateKey(year: number, month: number, day: number) {
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
}
function cellText(entry?: Entry) {
  const note = entry?.note?.trim()
  return note ? note.slice(0, 2).toUpperCase() : entry ? STATUS[entry.status].short : ''
}

export function MonthlyAttendanceSheet({ employees, initialEntries, year, month, companyName, standardHours, canManage }: {
  employees: Employee[]
  initialEntries: Entry[]
  year: number
  month: number
  companyName: string
  standardHours: number
  canManage: boolean
}) {
  const router = useRouter()
  const [staff, setStaff] = useState(employees)
  const [entries, setEntries] = useState<Record<string, Entry>>(() => Object.fromEntries(initialEntries.map((entry) => [entry.employeeId + ':' + entry.workDate.slice(0, 10), entry])))
  const [editor, setEditor] = useState<{ employee: Employee; day: number } | null>(null)
  const [status, setStatus] = useState<Status>('PRESENT')
  const [hours, setHours] = useState(String(standardHours))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [tool, setTool] = useState<Tool>('EDIT')
  const [copiedEntry, setCopiedEntry] = useState<Entry | null>(null)
  const [copySource, setCopySource] = useState<string | null>(null)
  const [paintCount, setPaintCount] = useState(0)
  const [orderMode, setOrderMode] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const painting = useRef(false)
  const paintedCells = useRef(new Set<string>())
  const days = new Date(year, month, 0).getDate()

  useEffect(() => {
    const stop = () => { painting.current = false; paintedCells.current.clear() }
    window.addEventListener('pointerup', stop)
    window.addEventListener('blur', stop)
    return () => { window.removeEventListener('pointerup', stop); window.removeEventListener('blur', stop) }
  }, [])

  const orderedStaff = useMemo(() => GROUPS.flatMap((category) => staff.filter((employee) => employee.category === category).sort((a, b) => a.sortOrder - b.sortOrder || a.lastName.localeCompare(b.lastName, 'ro'))), [staff])
  const totals = useMemo(() => Object.fromEntries(staff.map((employee) => {
    const list = Object.values(entries).filter((entry) => entry.employeeId === employee.id)
    return [employee.id, { hours: list.reduce((sum, entry) => sum + (entry.hours || 0), 0), present: list.filter((entry) => entry.status === 'PRESENT').length, leave: list.filter((entry) => entry.status === 'VACATION' || entry.status === 'MEDICAL').length }]
  })), [staff, entries])

  function changeMonth(offset: number) {
    const next = new Date(year, month - 1 + offset, 1)
    router.push('/dashboard/pontaje?month=' + next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0'))
  }
  function printAttendance() {
    const existing = document.getElementById('attendance-page-orientation')
    existing?.remove()
    const style = document.createElement('style')
    style.id = 'attendance-page-orientation'
    style.textContent = '@page { size: A4; margin: 10mm; }'
    document.head.appendChild(style)
    document.body.classList.add('attendance-printing')
    const cleanup = () => {
      document.body.classList.remove('attendance-printing')
      document.getElementById('attendance-page-orientation')?.remove()
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
    window.setTimeout(cleanup, 3000)
  }
  function openEditor(employee: Employee, day: number) {
    if (!canManage) return
    const existing = entries[employee.id + ':' + dateKey(year, month, day)]
    setEditor({ employee, day }); setStatus(existing?.status ?? 'PRESENT'); setHours(String(existing?.hours ?? employee.dailyHours ?? standardHours)); setNote(existing?.note ?? '')
  }
  async function persist(employeeId: string, date: string, nextStatus: Status | null, nextHours: number, nextNote = '') {
    const response = await fetch('/api/attendance/daily', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId, date, status: nextStatus, hours: nextHours, note: nextNote }) })
    if (!response.ok) throw new Error('save failed')
  }
  async function paintCell(employee: Employee, day: number) {
    if (tool === 'EDIT' || (tool === 'COPY' && !copiedEntry)) return
    const date = dateKey(year, month, day)
    const key = employee.id + ':' + date
    if (paintedCells.current.has(key)) return
    paintedCells.current.add(key)
    const previous = entries[key]
    const nextStatus: Status | null = tool === 'ERASE' ? null : tool === 'COPY' ? copiedEntry!.status : tool
    const nextHours = tool === 'COPY' ? copiedEntry!.hours : nextStatus === 'PRESENT' ? (employee.dailyHours || standardHours) : 0
    const nextNote = tool === 'COPY' ? copiedEntry!.note || '' : ''
    setEntries((current) => { const next = { ...current }; if (!nextStatus) delete next[key]; else next[key] = { employeeId: employee.id, workDate: date, status: nextStatus, hours: nextHours, note: nextNote || null }; return next })
    setPaintCount((value) => value + 1)
    try { await persist(employee.id, date, nextStatus, nextHours, nextNote) } catch { setEntries((current) => { const restored = { ...current }; if (previous) restored[key] = previous; else delete restored[key]; return restored }) }
  }
  function startCell(event: React.PointerEvent, employee: Employee, day: number) {
    if (!canManage) return
    if (orderMode || tool === 'EDIT' || event.button !== 0) return
    const key = employee.id + ':' + dateKey(year, month, day)
    if (tool === 'COPY' && !copiedEntry) {
      const source = entries[key]
      if (!source) return
      event.preventDefault(); setCopiedEntry({ ...source }); setCopySource(key); return
    }
    event.preventDefault(); painting.current = true; paintedCells.current.clear(); paintCell(employee, day)
  }
  async function save(nextStatus: Status | null) {
    if (!editor) return
    setSaving(true)
    const date = dateKey(year, month, editor.day)
    try {
      await persist(editor.employee.id, date, nextStatus, Number(hours) || 0, note)
      const key = editor.employee.id + ':' + date
      setEntries((current) => { const next = { ...current }; if (!nextStatus) delete next[key]; else next[key] = { employeeId: editor.employee.id, workDate: date, status: nextStatus, hours: nextStatus === 'PRESENT' ? Number(hours) || 0 : 0, note: note || null }; return next })
      setEditor(null)
    } catch { alert('Pontajul nu a putut fi salvat.') } finally { setSaving(false) }
  }
  async function moveEmployee(targetCategory: Category, targetId?: string) {
    if (!canManage) return
    if (!draggedId) return
    const dragged = staff.find((employee) => employee.id === draggedId)
    if (!dragged) return
    const without = staff.filter((employee) => employee.id !== draggedId)
    const targetIndex = targetId ? without.findIndex((employee) => employee.id === targetId) : -1
    const moved = { ...dragged, category: targetCategory }
    if (targetIndex >= 0) without.splice(targetIndex, 0, moved); else without.push(moved)
    const normalized = without.map((employee) => ({ ...employee, sortOrder: without.filter((item) => item.category === employee.category).findIndex((item) => item.id === employee.id) }))
    setStaff(normalized); setDraggedId(null)
    const response = await fetch('/api/attendance/employees', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employees: normalized.map((employee) => ({ id: employee.id, category: employee.category, sortOrder: employee.sortOrder })) }) })
    if (!response.ok) { alert('Ordinea nu a putut fi salvată.'); router.refresh() }
  }

  return <div className="attendance-page">
    <div className="attendance-toolbar no-print">
      <div><h1 className="text-2xl font-semibold">Foaie colectivă de prezență</h1><p className="text-sm text-slate-500 mt-1">Pensulă pentru completare · Copiere pentru starea, orele și notița unei căsuțe.</p></div>
      <div className="flex flex-wrap items-center gap-2">{canManage&&<button onClick={() => setOrderMode((value) => !value)} className={orderMode ? 'btn-primary' : 'btn-secondary'}>{orderMode ? 'Finalizează ordinea' : 'Editare ordine'}</button>}<div className="attendance-month-picker"><button onClick={() => changeMonth(-1)}><ChevronLeft size={17}/></button><strong>{MONTHS[month - 1]} {year}</strong><button onClick={() => changeMonth(1)}><ChevronRight size={17}/></button></div><button className="btn-primary inline-flex items-center gap-2" onClick={printAttendance}><Printer size={17}/> Printează / PDF</button></div>
    </div>
    <div className={canManage ? 'attendance-brushbar no-print' : 'hidden'}>
      <span className="attendance-brush-label">Instrument:</span>
      <button className={'attendance-brush ' + (tool === 'EDIT' ? 'selected' : '')} onClick={() => setTool('EDIT')}><MousePointer2 size={15}/> Selectare</button>
      {(Object.keys(STATUS) as Status[]).map((value) => <button key={value} className={'attendance-brush ' + (tool === value ? 'selected' : '')} onClick={() => setTool(value)}><b className={STATUS[value].className}>{STATUS[value].short}</b>{STATUS[value].label}</button>)}
      <button className={'attendance-brush ' + (tool === 'COPY' ? 'selected' : '')} onClick={() => { setTool('COPY'); setCopiedEntry(null); setCopySource(null) }}><Copy size={15}/> Copiere</button>
      <button className={'attendance-brush ' + (tool === 'ERASE' ? 'selected' : '')} onClick={() => setTool('ERASE')}><Eraser size={15}/> Radieră</button>
      {tool === 'COPY' && <span className="attendance-brush-hint">{copiedEntry ? 'Model copiat · trage peste destinații' : 'Apasă pe căsuța-sursă'}</span>}
      {tool !== 'EDIT' && tool !== 'COPY' && <span className="attendance-brush-hint">Ține click și trage{paintCount ? ' · ' + paintCount + ' modificări' : ''}</span>}
    </div>

    <section className="attendance-paper">
      <div className="attendance-print-heading"><h1>FOAIE COLECTIVĂ DE PREZENȚĂ</h1><p>{companyName} · {MONTHS[month - 1]} {year}</p></div>
      <div className="attendance-print-legend">{Object.values(STATUS).map((value) => <span key={value.short}><b className={value.className}>{value.short}</b> {value.label}</span>)}</div>
      <div className="card attendance-sheet-wrap"><table className="attendance-sheet">
        <thead><tr><th className="attendance-nr">Nr.</th><th className="attendance-name">Nume și prenume</th>{Array.from({ length: days }, (_, index) => { const day = index + 1; const weekday = new Date(year, month - 1, day).getDay(); return <th key={day} className={weekday === 0 || weekday === 6 ? 'is-weekend' : ''}><span>{day}</span><small>{['D','L','M','M','J','V','S'][weekday]}</small></th> })}<th className="attendance-total">Ore</th><th className="attendance-total">P</th><th className="attendance-total">C</th></tr></thead>
        <tbody>{orderedStaff.map((employee, index) => <Fragment key={employee.id}>
          {(index === 0 || orderedStaff[index - 1].category !== employee.category) && <tr className="attendance-group-row" onDragOver={(event) => orderMode && event.preventDefault()} onDrop={() => moveEmployee(employee.category)}><th colSpan={days + 5}>{employee.category === 'TESA' ? 'TESA' : 'PRODUCȚIE'}</th></tr>}
          <tr draggable={canManage && orderMode} onDragStart={() => setDraggedId(employee.id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => orderMode && event.preventDefault()} onDrop={(event) => { event.stopPropagation(); moveEmployee(employee.category, employee.id) }} className={(orderMode ? 'attendance-order-row ' : '') + (draggedId === employee.id ? 'opacity-35' : '')}>
            <td className="attendance-nr">{index + 1}</td><th className="attendance-name">{orderMode && <GripVertical size={13}/>}<span>{employee.lastName.toUpperCase()} {employee.firstName}</span><small>{employee.position || 'Angajat'} · {employee.dailyHours}h/zi</small></th>
            {Array.from({ length: days }, (_, dayIndex) => { const day = dayIndex + 1; const key = employee.id + ':' + dateKey(year, month, day); const entry = entries[key]; const weekday = new Date(year, month - 1, day).getDay(); return <td key={day} className={(weekday === 0 || weekday === 6 ? 'is-weekend ' : '') + (copySource === key ? 'copy-source' : '')}><button className={entry ? STATUS[entry.status].className : ''} onDoubleClick={() => !orderMode && tool === 'EDIT' && openEditor(employee, day)} onPointerDown={(event) => startCell(event, employee, day)} onPointerEnter={() => painting.current && paintCell(employee, day)} title={entry ? STATUS[entry.status].label + ' · ' + (entry.hours || 0) + ' ore' + (entry.note ? ' · ' + entry.note : '') : 'Nepontat'}>{cellText(entry)}</button></td> })}
            <td className="attendance-total">{totals[employee.id].hours || ''}</td><td className="attendance-total">{totals[employee.id].present || ''}</td><td className="attendance-total">{totals[employee.id].leave || ''}</td>
          </tr>
        </Fragment>)}</tbody>
      </table></div>
      <div className="attendance-signatures"><span>Întocmit de: ____________________</span><span>Verificat: ____________________</span><span>Semnătură: ____________________</span></div>
    </section>

    {editor && <div className="fixed inset-0 z-50 bg-slate-950/35 flex items-center justify-center p-4 no-print" onMouseDown={() => setEditor(null)}><div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex justify-between gap-4"><div><h2 className="text-xl font-semibold">{editor.employee.lastName} {editor.employee.firstName}</h2><p className="text-sm text-slate-500 mt-1">{editor.day} {MONTHS[month - 1]} {year}</p></div><button onClick={() => setEditor(null)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><X size={17}/></button></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">{(Object.keys(STATUS) as Status[]).map((value) => <button key={value} onClick={() => setStatus(value)} className={'attendance-status-choice ' + (status === value ? 'selected' : '')}><b className={STATUS[value].className}>{STATUS[value].short}</b><span>{STATUS[value].label}</span>{status === value && <Check size={15}/>}</button>)}</div>
      {status === 'PRESENT' && <label className="block mt-4 text-sm font-medium">Ore lucrate<input className="input-field w-full mt-1.5" type="number" min="0" max="24" step="0.5" value={hours} onChange={(event) => setHours(event.target.value)}/></label>}
      <label className="block mt-3 text-sm font-medium">Notă opțională<input className="input-field w-full mt-1.5" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Primele 2 litere vor apărea în căsuță"/></label>
      <div className="flex items-center justify-between gap-2 mt-6"><button className="text-sm text-red-600 px-2 py-2" disabled={saving} onClick={() => save(null)}>Șterge pontajul</button><button className="btn-primary" disabled={saving} onClick={() => save(status)}>{saving ? 'Se salvează...' : 'Salvează'}</button></div>
    </div></div>}
  </div>
}