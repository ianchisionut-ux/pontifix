'use client'

import { useState } from 'react'
import { Pencil, Plus, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Employee = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; position: string | null; department: string | null; employmentType: string; weeklyHours: number; dailyHours: number; active: boolean }
const EMPTY = { firstName: '', lastName: '', email: '', phone: '', position: '', department: '', employmentType: 'FULL_TIME', weeklyHours: 40, dailyHours: 8, active: true }

export function EmployeeManager({ employees }: { employees: Employee[] }) {
  const [editing, setEditing] = useState<Employee | null | 'new'>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const current = editing === 'new' || editing === null ? EMPTY : editing

  async function submit(formData: FormData) {
    setBusy(true)
    const values = Object.fromEntries(formData)
    const payload = { ...values, weeklyHours: Number(values.weeklyHours), dailyHours: Number(values.dailyHours), active: formData.get('active') === 'on', ...(editing !== 'new' && editing ? { id: editing.id } : {}) }
    const response = await fetch('/api/attendance/employees', {
      method: editing === 'new' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setBusy(false)
    if (!response.ok) return alert((await response.json()).error || 'Angajatul nu a putut fi salvat.')
    setEditing(null)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-semibold">Angajați</h1><p className="text-sm text-slate-500 mt-1">Editează numele preluate din foaia veche sau adaugă colegi noi.</p></div>
        <button onClick={() => setEditing('new')} className="btn-primary inline-flex items-center gap-2"><Plus size={17}/> Adaugă angajat</button>
      </div>

      {employees.length === 0 ? (
        <div className="card p-10 text-center"><Users className="mx-auto text-blue-300" size={36}/><h2 className="font-semibold mt-3">Adaugă primul angajat</h2></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {employees.map((employee) => (
            <div key={employee.id} className={`card p-4 flex items-center justify-between gap-4 ${employee.active ? '' : 'opacity-55'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">{employee.firstName[0]}{employee.lastName[0]}</div>
                <div className="min-w-0"><p className="font-medium truncate">{employee.firstName} {employee.lastName}</p><p className="text-sm text-slate-500 truncate">{employee.position || 'Angajat'}{employee.department ? ` · ${employee.department}` : ''}</p></div>
              </div>
              <div className="flex items-center gap-3 shrink-0"><div className="text-right hidden sm:block"><p className="text-sm font-medium">{employee.dailyHours}h / zi · {employee.weeklyHours}h / săpt.</p><p className="text-xs text-slate-400">{employee.active ? 'Activ' : 'Inactiv'}</p></div><button onClick={() => setEditing(employee)} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-blue-100 hover:text-blue-700 flex items-center justify-center" aria-label="Editează"><Pencil size={15}/></button></div>
            </div>
          ))}
        </div>
      )}

      {editing && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={() => setEditing(null)}><form action={submit} onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl"><h2 className="text-xl font-semibold mb-5">{editing === 'new' ? 'Angajat nou' : 'Editează angajatul'}</h2><div className="grid sm:grid-cols-2 gap-3"><input className="input-field" name="firstName" placeholder="Prenume" defaultValue={current.firstName} required/><input className="input-field" name="lastName" placeholder="Nume" defaultValue={current.lastName} required/><input className="input-field" name="email" type="email" placeholder="Email" defaultValue={current.email || ''}/><input className="input-field" name="phone" placeholder="Telefon" defaultValue={current.phone || ''}/><input className="input-field" name="position" placeholder="Funcție" defaultValue={current.position || ''}/><input className="input-field" name="department" placeholder="Departament" defaultValue={current.department || ''}/><select className="input-field" name="employmentType" defaultValue={current.employmentType}><option value="FULL_TIME">Normă întreagă</option><option value="PART_TIME">Part-time</option><option value="CONTRACTOR">Colaborator</option></select><label className="text-sm font-medium">Ore pe săptămână<input className="input-field w-full mt-1.5" name="weeklyHours" type="number" step="0.5" defaultValue={current.weeklyHours} min="1" max="80"/></label><label className="text-sm font-medium">Ore pe zi<input className="input-field w-full mt-1.5" name="dailyHours" type="number" step="0.5" defaultValue={current.dailyHours} min="0.5" max="24"/></label>{editing !== 'new' && <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={current.active}/> Angajat activ (apare în calendar)</label>}</div><div className="flex justify-end gap-2 mt-6"><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Renunță</button><button className="btn-primary" disabled={busy}>{busy ? 'Se salvează...' : 'Salvează'}</button></div></form></div>}
    </div>
  )
}
