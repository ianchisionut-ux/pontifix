'use client'

import { useMemo, useState } from 'react'
import { GripVertical, Pencil, Plus, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Category = 'TESA' | 'PRODUCTIE'
type Employee = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; position: string | null; department: string | null; category: Category; employmentType: string; weeklyHours: number; dailyHours: number; sortOrder: number; active: boolean }
const EMPTY = { firstName: '', lastName: '', email: '', phone: '', position: '', department: '', category: 'PRODUCTIE' as Category, employmentType: 'FULL_TIME', weeklyHours: 40, dailyHours: 8, active: true }
const GROUPS: Array<{ key: Category; label: string; hint: string }> = [
  { key: 'TESA', label: 'TESA', hint: 'Personal tehnic, economic și administrativ' },
  { key: 'PRODUCTIE', label: 'PRODUCȚIE', hint: 'Personal direct productiv' },
]

export function EmployeeManager({ employees }: { employees: Employee[] }) {
  const [items, setItems] = useState(employees)
  const [editing, setEditing] = useState<Employee | null | 'new'>(null)
  const [orderMode, setOrderMode] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const current = editing === 'new' || editing === null ? EMPTY : editing
  const grouped = useMemo(() => Object.fromEntries(GROUPS.map((group) => [
    group.key,
    items.filter((employee) => employee.category === group.key).sort((a, b) => a.sortOrder - b.sortOrder || a.lastName.localeCompare(b.lastName, 'ro') || a.firstName.localeCompare(b.firstName, 'ro')),
  ])) as Record<Category, Employee[]>, [items])

  async function persistOrder(next: Employee[]) {
    const normalized = next.map((employee) => {
      const peers = next.filter((item) => item.category === employee.category)
      return { ...employee, sortOrder: peers.findIndex((item) => item.id === employee.id) }
    })
    setItems(normalized)
    const response = await fetch('/api/attendance/employees', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employees: normalized.map((employee) => ({ id: employee.id, category: employee.category, sortOrder: employee.sortOrder })) }),
    })
    if (!response.ok) { alert('Ordinea nu a putut fi salvată.'); router.refresh() }
  }

  function moveEmployee(targetCategory: Category, targetId?: string) {
    if (!draggedId) return
    const dragged = items.find((item) => item.id === draggedId)
    if (!dragged) return
    const without = items.filter((item) => item.id !== draggedId)
    const targetIndex = targetId ? without.findIndex((item) => item.id === targetId) : -1
    const moved = { ...dragged, category: targetCategory }
    if (targetIndex >= 0) without.splice(targetIndex, 0, moved)
    else without.push(moved)
    setDraggedId(null)
    persistOrder(without)
  }

  async function submit(formData: FormData) {
    setBusy(true)
    const values = Object.fromEntries(formData)
    const payload = { ...values, weeklyHours: Number(values.weeklyHours), dailyHours: Number(values.dailyHours), active: formData.get('active') === 'on', ...(editing !== 'new' && editing ? { id: editing.id } : {}) }
    const response = await fetch('/api/attendance/employees', { method: editing === 'new' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setBusy(false)
    if (!response.ok) return alert((await response.json()).error || 'Angajatul nu a putut fi salvat.')
    setEditing(null); router.refresh()
  }

  return <div>
    <div className="flex items-center justify-between gap-4 mb-7">
      <div><h1 className="text-2xl font-semibold">Angajați</h1><p className="text-sm text-slate-500 mt-1">Ordonați după nume; activează editarea pentru rearanjare manuală.</p></div>
      <div className="flex gap-2"><button onClick={() => setOrderMode((value) => !value)} className={orderMode ? 'btn-primary' : 'btn-secondary'}>{orderMode ? 'Finalizează ordinea' : 'Editare ordine'}</button><button onClick={() => setEditing('new')} className="btn-primary inline-flex items-center gap-2"><Plus size={17}/> Adaugă angajat</button></div>
    </div>

    {items.length === 0 ? <div className="card p-10 text-center"><Users className="mx-auto text-blue-300" size={36}/><h2 className="font-semibold mt-3">Adaugă primul angajat</h2></div> :
      <div className="space-y-8">{GROUPS.map((group) => <section key={group.key} onDragOver={(event) => orderMode && event.preventDefault()} onDrop={() => moveEmployee(group.key)}>
        <div className="flex items-end justify-between gap-3 mb-3"><div><h2 className="text-sm font-extrabold tracking-[.08em] text-blue-800">{group.label}</h2><p className="text-xs text-slate-400 mt-1">{group.hint}</p></div><span className="employee-count">{grouped[group.key].length} angajați</span></div>
        <div className="grid md:grid-cols-2 gap-3 min-h-16">{grouped[group.key].map((employee) => <div key={employee.id} draggable={orderMode} onDragStart={() => setDraggedId(employee.id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => orderMode && event.preventDefault()} onDrop={(event) => { event.stopPropagation(); moveEmployee(group.key, employee.id) }} className={'card p-4 flex items-center justify-between gap-4 ' + (employee.active ? '' : 'opacity-55 ') + (orderMode ? 'employee-draggable ' : '') + (draggedId === employee.id ? 'opacity-35' : '')}>
          <div className="flex items-center gap-3 min-w-0">{orderMode && <GripVertical className="text-blue-500 shrink-0" size={18}/>}<div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">{employee.lastName[0]}{employee.firstName[0]}</div><div className="min-w-0"><p className="font-semibold truncate">{employee.lastName.toUpperCase()} {employee.firstName}</p><p className="text-sm text-slate-500 truncate">{employee.position || 'Angajat'}{employee.department ? ' · ' + employee.department : ''}</p></div></div>
          <div className="flex items-center gap-3 shrink-0"><div className="text-right hidden sm:block"><p className="text-sm font-medium">{employee.dailyHours}h / zi · {employee.weeklyHours}h / săpt.</p><p className="text-xs text-slate-400">{employee.active ? 'Activ' : 'Inactiv'}</p></div>{!orderMode && <button onClick={() => setEditing(employee)} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-blue-100 hover:text-blue-700 flex items-center justify-center" aria-label="Editează"><Pencil size={15}/></button>}</div>
        </div>)}</div>
      </section>)}</div>}

    {editing && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={() => setEditing(null)}><form action={submit} onMouseDown={(event) => event.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl"><h2 className="text-xl font-semibold mb-5">{editing === 'new' ? 'Angajat nou' : 'Editează angajatul'}</h2><div className="grid sm:grid-cols-2 gap-3">
      <input className="input-field" name="firstName" placeholder="Prenume" defaultValue={current.firstName} required/><input className="input-field" name="lastName" placeholder="Nume" defaultValue={current.lastName} required/>
      <select className="input-field sm:col-span-2" name="category" defaultValue={current.category}><option value="TESA">TESA — personal administrativ</option><option value="PRODUCTIE">PRODUCȚIE — personal productiv</option></select>
      <input className="input-field" name="email" type="email" placeholder="Email" defaultValue={current.email || ''}/><input className="input-field" name="phone" placeholder="Telefon" defaultValue={current.phone || ''}/>
      <input className="input-field" name="position" placeholder="Funcție" defaultValue={current.position || ''}/><input className="input-field" name="department" placeholder="Departament" defaultValue={current.department || ''}/>
      <select className="input-field" name="employmentType" defaultValue={current.employmentType}><option value="FULL_TIME">Normă întreagă</option><option value="PART_TIME">Part-time</option><option value="CONTRACTOR">Colaborator</option></select>
      <label className="text-sm font-medium">Ore pe săptămână<input className="input-field w-full mt-1.5" name="weeklyHours" type="number" step="0.5" defaultValue={current.weeklyHours} min="1" max="80"/></label>
      <label className="text-sm font-medium">Ore pe zi<input className="input-field w-full mt-1.5" name="dailyHours" type="number" step="0.5" defaultValue={current.dailyHours} min="0.5" max="24"/></label>
      {editing !== 'new' && <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={current.active}/> Angajat activ (apare în calendar)</label>}
    </div><div className="flex justify-end gap-2 mt-6"><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Renunță</button><button className="btn-primary" disabled={busy}>{busy ? 'Se salvează...' : 'Salvează'}</button></div></form></div>}
  </div>
}
