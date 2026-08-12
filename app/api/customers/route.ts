import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  name: z.string().optional(),
  phone: z.string().min(3),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  allergies: z.string().optional(),
  medicalNotes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.customer.findFirst({ where: { businessId, phone: parsed.data.phone } })
  if (existing) {
    return NextResponse.json({ error: 'Există deja un client cu acest număr de telefon.' }, { status: 409 })
  }

  const { dateOfBirth, ...rest } = parsed.data
  const customer = await prisma.customer.create({
    data: { businessId, ...rest, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null },
  })
  return NextResponse.json({ customer })
}
