import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { syncDeerBorderouri } from '@/lib/deer-borderou-mail'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate verifica e-mailul.' }, { status: 403 })
  try { return NextResponse.json(await syncDeerBorderouri(businessId)) }
  catch (error) { console.error('DEER borderou mail sync:', error); return NextResponse.json({ error: error instanceof Error ? error.message : 'E-mailul DEER nu poate fi verificat.' }, { status: 502 }) }
}
