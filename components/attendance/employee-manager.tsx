'use client'

import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Employee = { id: string; firstName: string; lastName: string; email: string | null; position: string | null; department: string | null; employmentType: string; weeklyHours: number; active: boolean }

export function EmployeeManager({ employees }: { employees: Employee[] }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function submit(formData: FormData) {
    setBusy(true)
    const response = await fetch('/api/attendance/employees', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData)),
    })
    setBusy(false)
    if (!response.ok) return alert('Angajatul nu a putut fi adăugat.')
    setOpen(false)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-semibold">Angajați</h1><p className="text-sm text-slate-500 mt-1">Echipa, rolurile și normele de lucru.</p></div>
        <button onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={17}/> Adaugă angajat</button>
      </div>

      {employees.length === 0 ? (
        <div className="card p-10 text-center"><Users className="mx-auto text-slate-300" size={36}/><h2 className="font-semibold mt-3">Adaugă primul angajat</h2><p className="text-sm text-slate-500 mt-1">Pontajele vor fi asociate automat fiecărui membru al echipei.</p></div>
      ) : (
        <div className="grid gap-3">
          {employees.map((employee) => (
            <div key={employee.id} className="card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-semibold">{employee.firstName[0]}{employee.lastName[0]}</div>
                <div className="min-w-0"><p className="font-medium truncate">{employee.firstName} {employee.lastName}</p><p className="text-sm text-slate-500 truncate">{employee.position || 'Fără funcție'}{employee.department ? ` · ${employee.department}` : ''}</p></div>
              </div>
              <div className="text-right shrink-0"><p className="text-sm font-medium">{employee.weeklyHours}h / săptămână</p><p className="text-xs text-slate-400">{employee.active ? 'Activ' : 'Inactiv'}</p></div>
            </div>
          ))}
        </div>
      )}

      {open && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={() => setOpen(false)}><form action={submit} onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl"><h2 className="text-xl font-semibold mb-5">Angajat nou</h2><div className="grid sm:grid-cols-2 gap-3"><input className="input-field" name="firstName" placeholder="Prenume" required/><input className="input-field" name="lastName" placeholder="Nume" required/><input className="input-field" name="email" type="email" placeholder="Email"/><input className="input-field" name="phone" placeholder="Telefon"/><input className="input-field" name="position" placeholder="Funcție"/><input className="input-field" name="department" placeholder="Departament"/><select className="input-field" name="employmentType" defaultValue="FULL_TIME"><option value="FULL_TIME">Normă întreagă</option><option value="PART_TIME">Part-time</option><option value="CONTRACTOR">Colaborator</option></select><input className="input-field" name="weeklyHours" type="number" defaultValue="40" min="1" max="80"/></div><div className="flex justify-end gap-2 mt-6"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Renunță</button><button className="btn-primary" disabled={busy}>{busy ? 'Se salvează...' : 'Adaugă'}</button></div></form></div>}
    </div>
  )
}
