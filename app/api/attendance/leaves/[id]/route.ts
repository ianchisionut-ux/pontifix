import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AttendanceDayStatus, LeaveStatus, Prisma } from '@prisma/client'
import { z } from 'zod'

const editSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(['VACATION', 'MEDICAL', 'PERSONAL', 'UNPAID']),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().trim().optional(),
})

function attendanceStatus(type: string) {
  return type === 'VACATION' ? AttendanceDayStatus.VACATION : type === 'MEDICAL' ? AttendanceDayStatus.MEDICAL : AttendanceDayStatus.DAY_OFF
}

function attendanceDays(request: { id: string; businessId: string; employeeId: string; type: string; startDate: Date; endDate: Date }) {
  const rows: Prisma.DailyAttendanceCreateManyInput[] = []
  const start = new Date(request.startDate); start.setUTCHours(0, 0, 0, 0)
  const end = new Date(request.endDate); end.setUTCHours(0, 0, 0, 0)
  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    rows.push({ businessId: request.businessId, employeeId: request.employeeId, workDate: new Date(day), status: attendanceStatus(request.type), hours: 0, leaveRequestId: request.id })
  }
  return rows
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  if ((session as any)?.role === 'STAFF') return NextResponse.json({ error: 'Cont cu acces doar pentru vizualizare.' }, { status: 403 })
  const { id } = await params
  const found = await prisma.leaveRequest.findFirst({ where: { id, businessId } })
  if (!found) return NextResponse.json({ error: 'Cerere inexistentă.' }, { status: 404 })
  const body = await req.json()

  if (typeof body.status === 'string' && Object.keys(body).length === 1) {
    if (!['APPROVED', 'REJECTED'].includes(body.status)) return NextResponse.json({ error: 'Status invalid.' }, { status: 400 })
    const status = body.status as LeaveStatus
    await prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({ where: { id }, data: { status } })
      await tx.dailyAttendance.deleteMany({ where: { businessId, leaveRequestId: id } })
      if (status === LeaveStatus.APPROVED) await tx.dailyAttendance.createMany({ data: attendanceDays({ ...found, id, businessId }), skipDuplicates: true })
    })
    return NextResponse.json({ success: true })
  }

  const parsed = editSchema.safeParse(body)
  if (!parsed.success || parsed.data.endDate < parsed.data.startDate) return NextResponse.json({ error: 'Perioadă invalidă.' }, { status: 400 })
  const employee = await prisma.attendanceEmployee.findFirst({ where: { id: parsed.data.employeeId, businessId } })
  if (!employee) return NextResponse.json({ error: 'Angajat inexistent.' }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({ where: { id }, data: parsed.data })
    await tx.dailyAttendance.deleteMany({ where: { businessId, leaveRequestId: id } })
    if (updated.status === LeaveStatus.APPROVED) await tx.dailyAttendance.createMany({ data: attendanceDays({ ...updated, businessId }), skipDuplicates: true })
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  if ((session as any)?.role === 'STAFF') return NextResponse.json({ error: 'Cont cu acces doar pentru vizualizare.' }, { status: 403 })
  const { id } = await params
  const found = await prisma.leaveRequest.findFirst({ where: { id, businessId }, select: { id: true } })
  if (!found) return NextResponse.json({ error: 'Cerere inexistentă.' }, { status: 404 })
  await prisma.$transaction([
    prisma.dailyAttendance.deleteMany({ where: { businessId, leaveRequestId: id } }),
    prisma.leaveRequest.delete({ where: { id } }),
  ])
  return NextResponse.json({ success: true })
}