'use client'

import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetchWithTimeout('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      setSent(true) // afișăm oricum mesajul generic — nu confirmăm/infirmăm erori specifice aici
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--surface-muted)] px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <Link href="/">
          <Image src="/logo.png" alt="bookeasy.ro" width={200} height={133} priority className="w-[160px] h-auto" />
        </Link>

        <Card className="w-full">
          <h1 className="text-lg font-semibold mb-1">Am uitat parola</h1>

          {sent ? (
            <p className="text-sm text-gray-600 mt-3">
              Dacă există un cont cu acest email, ai primit un link de resetare. Verifică și folderul de spam.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">Introdu emailul contului tău, îți trimitem un link de resetare.</p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@exemplu.ro" />
                <Button type="submit" disabled={loading}>
                  {loading ? 'Se trimite...' : 'Trimite link de resetare'}
                </Button>
              </form>
            </>
          )}
        </Card>

        <Link href="/login" className="text-sm text-gray-500">
          ← Înapoi la login
        </Link>
      </div>
    </main>
  )
}
