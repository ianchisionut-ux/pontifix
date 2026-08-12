'use client'

import { useState } from 'react'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (newPassword !== confirmPassword) {
      setError('Parolele noi nu se potrivesc.')
      return
    }

    setSaving(true)
    try {
      const res = await fetchWithTimeout('/api/account/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare.')
        return
      }

      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError('Conexiune eșuată. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="text-sm text-gray-500 block mb-1.5">Parola actuală</label>
        <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
      </div>
      <div>
        <label className="text-sm text-gray-500 block mb-1.5">Parola nouă</label>
        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
      </div>
      <div>
        <label className="text-sm text-gray-500 block mb-1.5">Confirmă parola nouă</label>
        <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">Parola a fost schimbată cu succes.</p>}

      <Button type="submit" disabled={saving} className="mt-1 self-start">
        {saving ? 'Se salvează...' : 'Schimbă parola'}
      </Button>
    </form>
  )
}
