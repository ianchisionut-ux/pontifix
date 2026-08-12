import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const status = (await req.json()).status as string
  if (!['APPROVED', 'REJECTED'].includes(status)) return NextResponse.json({ error: 'Status invalid.' }, { status: 400 })
  const { id } = await params
  const found = await prisma.leaveRequest.findFirst({ where: { id, businessId } })
  if (!found) return NextResponse.json({ error: 'Cerere inexistentă.' }, { status: 404 })

  const operations: any[] = [prisma.leaveRequest.update({ where: { id }, data: { status: status as 'APPROVED' | 'REJECTED' } })]
  if (status === 'APPROVED') {
    const dayStatus = found.type === 'VACATION' ? 'VACATION' : found.type === 'MEDICAL' ? 'MEDICAL' : 'DAY_OFF'
    const start = new Date(found.startDate); start.setUTCHours(0, 0, 0, 0)
    const end = new Date(found.endDate); end.setUTCHours(0, 0, 0, 0)
    for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
      const workDate = new Date(day)
      operations.push(prisma.dailyAttendance.upsert({
        where: { employeeId_workDate: { employeeId: found.employeeId, workDate } },
        update: { status: dayStatus, hours: 0, note: null, leaveRequestId: id },
        create: { businessId, employeeId: found.employeeId, workDate, status: dayStatus, hours: 0, leaveRequestId: id },
      }))
    }
  } else {
    operations.push(prisma.dailyAttendance.deleteMany({ where: { businessId, leaveRequestId: id } }))
  }
  await prisma.$transaction(operations)
  return NextResponse.json({ success: true })
}
