'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'

type Employee = { id: string; firstName: string; lastName: string }
type Leave = { id: string; type: string; startDate: string; endDate: string; reason: string | null; status: string; employee: Employee }
const typeLabels: Record<string, string> = { VACATION: 'Concediu de odihnă', MEDICAL: 'Concediu medical', PERSONAL: 'Zi liberă', UNPAID: 'Fără plată' }
const statusLabels: Record<string, string> = { PENDING: 'În așteptare', APPROVED: 'Aprobat', REJECTED: 'Respins' }
const statusClasses: Record<string, string> = { PENDING: 'bg-amber-50 text-amber-700', APPROVED: 'bg-emerald-50 text-emerald-700', REJECTED: 'bg-rose-50 text-rose-700' }
const localDate = (value: string) => value.slice(0, 10)

export function LeaveManager({ employees, requests }: { employees: Employee[]; requests: Leave[] }) {
  const [editing, setEditing] = useState<Leave | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function save(formData: FormData) {
    setBusy(true)
    const isNew = editing === 'new'
    const response = await fetch(isNew ? '/api/attendance/leaves' : `/api/attendance/leaves/${(editing as Leave).id}`, {
      method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(formData)),
    })
    setBusy(false)
    if (!response.ok) return alert((await response.json()).error || 'Cererea nu a putut fi salvată.')
    setEditing(null); router.refresh()
  }

  async function decide(id: string, status: string) {
    const response = await fetch(`/api/attendance/leaves/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!response.ok) return alert((await response.json()).error || 'Starea nu a putut fi modificată.')
    router.refresh()
  }

  async function remove(request: Leave) {
    if (!confirm(`Ștergi cererea de concediu pentru ${request.employee.lastName} ${request.employee.firstName}? Zilele generate de această cerere vor fi eliminate din calendar.`)) return
    const response = await fetch(`/api/attendance/leaves/${request.id}`, { method: 'DELETE' })
    if (!response.ok) return alert((await response.json()).error || 'Cererea nu a putut fi ștearsă.')
    router.refresh()
  }

  const current = editing === 'new' || editing === null ? null : editing
  return <div>
    <div className="flex justify-between items-center gap-4 mb-6"><div><h1 className="text-2xl font-semibold">Concedii</h1><p className="text-sm text-slate-500 mt-1">Cereri, aprobări și gestiunea perioadelor de concediu.</p></div><button className="btn-primary inline-flex items-center gap-2" onClick={() => setEditing('new')}><Plus size={17}/> Cerere nouă</button></div>
    <div className="grid gap-3">{requests.length === 0 && <div className="card p-10 text-center text-slate-500">Nu există cereri de concediu.</div>}{requests.map(request => <div key={request.id} className="card p-4 flex flex-wrap items-center justify-between gap-4">
      <div><p className="font-semibold">{request.employee.lastName.toUpperCase()} {request.employee.firstName}</p><p className="text-sm text-slate-500">{typeLabels[request.type]} · {new Date(request.startDate).toLocaleDateString('ro-RO')} – {new Date(request.endDate).toLocaleDateString('ro-RO')}</p>{request.reason && <p className="text-sm mt-1">{request.reason}</p>}</div>
      <div className="flex flex-wrap items-center gap-2"><span className={`text-xs rounded-full px-3 py-1 ${statusClasses[request.status]}`}>{statusLabels[request.status]}</span>{request.status === 'PENDING' && <><button className="text-sm font-semibold text-emerald-700 px-2" onClick={() => decide(request.id, 'APPROVED')}>Aprobă</button><button className="text-sm font-semibold text-rose-600 px-2" onClick={() => decide(request.id, 'REJECTED')}>Respinge</button></>}<button className="w-9 h-9 rounded-full bg-slate-100 hover:bg-blue-100 hover:text-blue-700 flex items-center justify-center" onClick={() => setEditing(request)} title="Editează"><Pencil size={15}/></button><button className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center" onClick={() => remove(request)} title="Șterge"><Trash2 size={15}/></button></div>
    </div>)}</div>
    {editing && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={() => setEditing(null)}><form action={save} onMouseDown={event => event.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl"><h2 className="text-xl font-semibold mb-5">{editing === 'new' ? 'Cerere de concediu' : 'Editează concediul'}</h2><div className="grid gap-3">
      <select name="employeeId" className="input-field" defaultValue={current?.employee.id || ''} required><option value="">Selectează angajatul</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.lastName.toUpperCase()} {employee.firstName}</option>)}</select>
      <select name="type" className="input-field" defaultValue={current?.type || 'VACATION'}><option value="VACATION">Concediu de odihnă</option><option value="MEDICAL">Concediu medical</option><option value="PERSONAL">Zi liberă</option><option value="UNPAID">Fără plată</option></select>
      <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-500">De la<input name="startDate" type="date" className="input-field w-full mt-1" defaultValue={current ? localDate(current.startDate) : ''} required/></label><label className="text-xs font-semibold text-slate-500">Până la<input name="endDate" type="date" className="input-field w-full mt-1" defaultValue={current ? localDate(current.endDate) : ''} required/></label></div>
      <textarea name="reason" className="input-field min-h-24" placeholder="Observații" defaultValue={current?.reason || ''}/>{current?.status === 'APPROVED' && <p className="text-xs text-blue-700 bg-blue-50 rounded-xl p-3">Concediul este aprobat. Salvarea va actualiza automat perioada și în calendar.</p>}
    </div><div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Renunță</button><button className="btn-primary" disabled={busy}>{busy ? 'Se salvează...' : 'Salvează'}</button></div></form></div>}
  </div>
}