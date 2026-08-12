import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const employeeSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  position: z.string().trim().optional(),
  department: z.string().trim().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR']).default('FULL_TIME'),
  weeklyHours: z.coerce.number().min(1).max(80).default(40),
})

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const employees = await prisma.attendanceEmployee.findMany({ where: { businessId }, orderBy: [{ active: 'desc' }, { lastName: 'asc' }] })
  return NextResponse.json(employees)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const parsed = employeeSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele angajatului sunt incomplete.' }, { status: 400 })
  const employee = await prisma.attendanceEmployee.create({
    data: { ...parsed.data, email: parsed.data.email || null, businessId },
  })
  return NextResponse.json(employee, { status: 201 })
}
