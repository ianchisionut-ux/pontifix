import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export async function requireAccountingPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if ((session as any).role !== 'SUPER_ADMIN') redirect('/dashboard')
  return session
}

export function accountingApi<TArgs extends unknown[]>(handler: (...args: TArgs) => Promise<Response>) {
  return async (...args: TArgs): Promise<Response> => {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    if ((session as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Contabilitatea este disponibilă doar Super Adminului.' }, { status: 403 })
    }
    return handler(...args)
  }
}