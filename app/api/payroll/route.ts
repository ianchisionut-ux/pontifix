import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generatePayroll, getPayroll, updatePayrollLine } from '@/lib/payroll'
import { z } from 'zod'

async function business() {
  const session = await auth()
  if (!(session as any)?.businessId || (session as any)?.role === 'STAFF') return null
  return { id: (session as any).businessId as string, email: session?.user?.email || '' }
}

export async function GET(req: NextRequest) {
  const owner = await business()
  if (!owner) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const month = req.nextUrl.searchParams.get('month') || new Date().toISOString().slice(0, 7)
  return NextResponse.json(await getPayroll(owner.id, month))
}

export async function POST(req: NextRequest) {
  const owner = await business()
  if (!owner) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const month = String((await req.json()).month || '')
  try { return NextResponse.json(await generatePayroll(owner.id, month), { status: 201 }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Statul nu a putut fi generat.' }, { status: 400 }) }
}

const updateSchema = z.object({
  lineId: z.string().min(1), bonuses: z.coerce.number().min(0).optional(), medicalAllowance: z.coerce.number().min(0).optional(),
  taxableBenefits: z.coerce.number().min(0).optional(), mealTickets: z.coerce.number().min(0).optional(),
  otherDeductions: z.coerce.number().min(0).optional(), advancePaid: z.coerce.number().min(0).optional(),
  overtimeAmount: z.coerce.number().min(0).optional(), notes: z.string().max(500).optional(),
})

export async function PATCH(req: NextRequest) {
  const owner = await business()
  if (!owner) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Valorile nu sunt valide.' }, { status: 400 })
  const { lineId, ...values } = parsed.data
  try { return NextResponse.json(await updatePayrollLine(owner.id, lineId, values)) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Poziția nu a putut fi actualizată.' }, { status: 400 }) }
}
