import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { postPayrollPayment } from '@/lib/accounting/ledger'
import { getPayroll } from '@/lib/payroll'
import { canAccessAccounting } from '@/lib/accounting/permissions'
import { ensurePayrollSchema } from '@/lib/payroll-storage'

const schema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  type: z.enum(['NET_SALARIES', 'CAS', 'CASS', 'INCOME_TAX', 'CAM', 'OTHER_DEDUCTIONS']),
  method: z.enum(['BANK', 'CASH']),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId || !canAccessAccounting(session)) return NextResponse.json({ error: 'Nu ai acces la contabilitatea Elmont.' }, { status: 403 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele plății nu sunt valide.' }, { status: 400 })
  try {
    await ensurePayrollSchema()
    await postPayrollPayment({ businessId, ...parsed.data, createdBy: session?.user?.email || '' })
    return NextResponse.json(await getPayroll(businessId, parsed.data.month), { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Plata nu a putut fi înregistrată.' }, { status: 400 })
  }
}
