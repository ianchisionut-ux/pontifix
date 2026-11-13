'use client'

import { useEffect, useState } from 'react'

type Role = 'STAFF' | 'OWNER' | 'SUPER_ADMIN'
type Account = { id: string; email: string; role: Role; displayName: string; disabledAt: string | null }
const roleLabel: Record<Role, string> = { STAFF: 'Angajat', OWNER: 'Administrator', SUPER_ADMIN: 'Superadmin' }

export function UserAdministration() {
  const [users, setUsers] = useState<Account[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [newUser, setNewUser] = useState({ displayName: '', email: '', role: 'STAFF' as Role })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ displayName: '', email: '', role: 'STAFF' as Role })
  const [passwords, setPasswords] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    const response = await fetch('/api/admin/users', { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Nu am putut încărca utilizatorii.')
    setUsers(body.users)
    setCurrentUserId(body.currentUserId)
  }

  useEffect(() => { reload().catch((cause) => setError(cause.message)) }, [])

  async function request(url: string, method: string, data?: object) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Operația a eșuat.')
      if (body.temporaryPassword) setPasswords((current) => ({ ...current, [body.user?.id || url.split('/').pop() || '']: body.temporaryPassword }))
      await reload()
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Operația a eșuat.')
      return false
    } finally { setBusy(false) }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault()
    if (await request('/api/admin/users', 'POST', newUser)) setNewUser({ displayName: '', email: '', role: 'STAFF' })
  }

  async function save(id: string) {
    if (await request(`/api/admin/users/${id}`, 'PATCH', { action: 'edit', ...draft })) setEditingId(null)
  }

  async function remove(user: Account) {
    if (!confirm(`Ștergi accesul lui ${user.displayName}? Contul nu va mai putea intra în Elmont. Istoricul mesajelor se păstrează.`)) return
    await request(`/api/admin/users/${user.id}`, 'DELETE')
  }

  function downloadList() {
    const lines = ['ELMONT S.A. — CONTURI DE ACCES', `Export: ${new Date().toLocaleString('ro-RO')}`, '', ...users.flatMap((user) => [
      `${user.displayName} | ${user.email} | ${roleLabel[user.role]} | ${user.disabledAt ? 'acces șters' : 'activ'}`,
      `Parolă: ${user.email === 'ianchisionut@gmail.com' ? '[cunoscută de titular; neafișată]' : passwords[user.id] || '[nu poate fi recuperată; resetează parola din Configurare]'}`,
      '',
    ])]
    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'utilizatori-elmont.txt'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-bold text-[#082b4d]">Utilizatori și acces</h2><p className="mt-1 text-sm text-slate-600">Creează conturi, modifică roluri și resetează parole. Parolele existente sunt criptate și nu pot fi afișate.</p></div>
      <button type="button" onClick={downloadList} disabled={!users.length} className="btn-secondary">Descarcă utilizatori .txt</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <form onSubmit={create} className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(150px,.7fr)_auto] sm:items-end">
      <label className="text-sm font-semibold">Nume<input className="input-field mt-1 w-full" value={newUser.displayName} onChange={(event) => setNewUser({ ...newUser, displayName: event.target.value })} required minLength={2} /></label>
      <label className="text-sm font-semibold">E-mail de autentificare<input type="email" className="input-field mt-1 w-full" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required /></label>
      <label className="text-sm font-semibold">Rol<select className="input-field mt-1 w-full" value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value as Role })}>{Object.entries(roleLabel).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>
      <button className="btn-primary min-h-[44px]" disabled={busy}>Adaugă utilizator</button>
    </form>
    <p className="mt-3 text-xs text-slate-500">La creare și la resetare se generează o parolă nouă. Ea este afișată doar în această sesiune; descarcă fișierul înainte de a închide pagina.</p>
    <div className="mt-4 space-y-3">{users.map((user) => <div key={user.id} className="rounded-xl border border-slate-200 p-4">
      {editingId === user.id ? <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_160px_auto] sm:items-end">
        <label className="text-xs font-semibold">Nume<input className="input-field mt-1 w-full" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
        <label className="text-xs font-semibold">E-mail<input type="email" className="input-field mt-1 w-full" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
        <label className="text-xs font-semibold">Rol<select className="input-field mt-1 w-full" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}>{Object.entries(roleLabel).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></label>
        <button type="button" className="btn-primary min-h-[42px]" disabled={busy} onClick={() => save(user.id)}>Salvează</button>
      </div> : <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><strong className="block text-[#082b4d]">{user.displayName} {user.id === currentUserId && <span className="text-xs font-normal text-slate-500">(contul tău)</span>}</strong><span className="break-all text-sm text-slate-600">{user.email}</span><span className="ml-2 text-xs text-slate-500">{roleLabel[user.role]} · {user.disabledAt ? 'acces șters' : 'activ'}</span></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => { setEditingId(user.id); setDraft({ displayName: user.displayName, email: user.email, role: user.role }) }}>Editează</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => request(`/api/admin/users/${user.id}`, 'PATCH', { action: 'resetPassword' })}>Resetează parola</button>{user.disabledAt ? <button type="button" className="btn-secondary" disabled={busy} onClick={() => request(`/api/admin/users/${user.id}`, 'PATCH', { action: 'restore' })}>Reactivează</button> : user.id !== currentUserId && <button type="button" className="btn-secondary text-red-700" disabled={busy} onClick={() => remove(user)}>Șterge accesul</button>}</div></div>}
      {editingId === user.id && <button type="button" className="mt-2 text-sm text-slate-500 underline" onClick={() => setEditingId(null)}>Renunță</button>}
      {passwords[user.id] && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm"><strong>Parolă nouă generată:</strong> <code className="break-all select-all font-bold">{passwords[user.id]}</code><p className="mt-1 text-xs text-amber-900">Notează parola acum; nu va mai putea fi recuperată.</p></div>}
    </div>)}</div>
  </section>
}
