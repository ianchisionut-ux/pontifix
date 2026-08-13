'use client'

import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

function ResetPasswordForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Parolele nu se potrivesc.')
      return
    }
    if (!token) {
      setError('Link invalid — lipsește token-ul.')
      return
    }

    setLoading(true)
    try {
      const res = await fetchWithTimeout('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'A apărut o eroare.')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      setError('Conexiune eșuată. Verifică internetul și încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <h1 className="text-lg font-semibold mb-1">Setează parola</h1>

      {!token ? (
        <p className="text-sm text-red-600 mt-3">
          Link invalid sau incomplet. Cere din nou un link de resetare din pagina de login.
        </p>
      ) : done ? (
        <p className="text-sm text-green-700 mt-3">Parola a fost setată! Te redirecționăm spre login...</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">Alege o parolă nouă pentru contul tău.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Parolă nouă</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1.5">Confirmă parola</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Se salvează...' : 'Setează parola'}
            </Button>
          </form>
        </>
      )}
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--surface-muted)] px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <Link href="/">
          <span className="text-2xl font-semibold">Elmont</span>
        </Link>
        <Suspense fallback={<p className="text-sm text-gray-500">Se încarcă...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  )
}
