import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const leaveSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(['VACATION', 'MEDICAL', 'PERSONAL', 'UNPAID']),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().trim().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  if ((session as any)?.role === 'STAFF') return NextResponse.json({ error: 'Cont cu acces doar pentru vizualizare.' }, { status: 403 })
  const parsed = leaveSchema.safeParse(await req.json())
  if (!parsed.success || parsed.data.endDate < parsed.data.startDate) return NextResponse.json({ error: 'Perioadă invalidă.' }, { status: 400 })
  const employee = await prisma.attendanceEmployee.findFirst({ where: { id: parsed.data.employeeId, businessId } })
  if (!employee) return NextResponse.json({ error: 'Angajat inexistent.' }, { status: 404 })
  const request = await prisma.leaveRequest.create({ data: { ...parsed.data, businessId } })
  return NextResponse.json(request, { status: 201 })
}