import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { finalizePayroll } from '@/lib/payroll'
import { canAccessAccounting } from '@/lib/accounting/permissions'

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId || !canAccessAccounting(session)) return NextResponse.json({ error: 'Nu ai acces la contabilitatea Elmont.' }, { status: 403 })
  const month = String((await req.json()).month || '')
  try { return NextResponse.json(await finalizePayroll(businessId, month, session?.user?.email || '')) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Statul nu a putut fi finalizat.' }, { status: 400 }) }
}
