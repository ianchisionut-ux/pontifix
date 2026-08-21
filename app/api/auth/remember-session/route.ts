import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const SESSION_MAX_AGE = 60 * 60 * 24 * 90
const SESSION_COOKIE = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { remember?: boolean }
  const sessionCookies = request.cookies.getAll().filter((cookie) => SESSION_COOKIE.test(cookie.name))
  if (!sessionCookies.length) return NextResponse.json({ error: 'Sesiunea nu a fost găsită.' }, { status: 400 })

  const response = NextResponse.json({ ok: true })
  for (const cookie of sessionCookies) {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      priority: 'high',
      ...(body.remember ? { maxAge: SESSION_MAX_AGE, expires: new Date(Date.now() + SESSION_MAX_AGE * 1000) } : {}),
    })
  }
  response.headers.set('Cache-Control', 'no-store')
  return response
}
