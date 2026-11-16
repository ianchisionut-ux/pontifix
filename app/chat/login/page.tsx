'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { MessageCircle } from 'lucide-react'

export default function ChatLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await signIn('credentials', { email, password, remember: 'true', redirect: false })
      if (result?.error || !result?.ok) {
        setError('E-mail sau parolă greșită.')
        return
      }
      await fetch('/api/auth/remember-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remember: true }) }).catch(() => undefined)
      router.replace('/chat')
      router.refresh()
    } catch {
      setError('Autentificarea nu a reușit. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="flex min-h-dvh items-center justify-center bg-[#f3f8fc] px-4 py-8">
    <section className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-6 shadow-xl sm:p-8">
      <div className="flex items-center gap-3 text-[#082b4d]"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0d5d8b] text-white"><MessageCircle size={26}/></span><h1 className="text-2xl font-bold">Chat Elmont</h1></div>
      <p className="mt-4 text-sm text-slate-600">Autentifică-te pentru a continua conversațiile.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-[#082b4d]">E-mail<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="input-field mt-1 w-full" /></label>
        <label className="block text-sm font-semibold text-[#082b4d]">Parolă<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="input-field mt-1 w-full" /></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Se conectează…' : 'Intră în chat'}</button>
      </form>
    </section>
  </main>
}
