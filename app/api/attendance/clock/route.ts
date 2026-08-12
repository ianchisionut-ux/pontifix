import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOrCreateEmployeeForUser } from '@/lib/attendance'

export async function POST() {
  const session = await auth()
  const userId = (session as any)?.userId as string | undefined
  const businessId = (session as any)?.businessId as string | undefined
  const email = session?.user?.email ?? ''
  if (!userId || !businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const employee = await getOrCreateEmployeeForUser(userId, businessId, email)
  const open = await prisma.timeEntry.findFirst({
    where: { businessId, employeeId: employee.id, clockOut: null },
    orderBy: { clockIn: 'desc' },
  })

  if (open) {
    const entry = await prisma.timeEntry.update({ where: { id: open.id }, data: { clockOut: new Date() } })
    return NextResponse.json({ action: 'clock-out', entry })
  }

  const entry = await prisma.timeEntry.create({
    data: { businessId, employeeId: employee.id, clockIn: new Date(), source: 'WEB' },
  })
  return NextResponse.json({ action: 'clock-in', entry })
}
