import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['PRESENT', 'ABSENT', 'VACATION', 'MEDICAL', 'DAY_OFF']).nullable(),
  hours: z.coerce.number().min(0).max(24).default(0),
  note: z.string().trim().max(200).optional(),
})

export async function PUT(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date de pontaj invalide.' }, { status: 400 })
  const { employeeId, date, status, hours, note } = parsed.data
  const employee = await prisma.attendanceEmployee.findFirst({ where: { id: employeeId, businessId, active: true }, select: { id: true } })
  if (!employee) return NextResponse.json({ error: 'Angajatul nu există.' }, { status: 404 })

  const workDate = new Date(`${date}T00:00:00.000Z`)
  if (!status) {
    await prisma.dailyAttendance.deleteMany({ where: { businessId, employeeId, workDate } })
    return NextResponse.json({ deleted: true })
  }

  const entry = await prisma.dailyAttendance.upsert({
    where: { employeeId_workDate: { employeeId, workDate } },
    update: { status, hours: status === 'PRESENT' ? hours : 0, note: note || null },
    create: { businessId, employeeId, workDate, status, hours: status === 'PRESENT' ? hours : 0, note: note || null },
  })
  return NextResponse.json(entry)
}
