import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  name: z.string().optional(),
  phone: z.string().min(3).optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional(),
  dateOfBirth: z.string().optional(),
  allergies: z.string().optional(),
  medicalNotes: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId

  const customer = await prisma.customer.findUnique({ where: { id } })
  if (!customer || customer.businessId !== businessId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // telefonul e cheia de identificare a clientului pe WhatsApp — dacă se schimbă,
  // verificăm că nu intră în conflict cu alt client existent al aceluiași business
  if (parsed.data.phone && parsed.data.phone !== customer.phone) {
    const conflict = await prisma.customer.findFirst({
      where: { businessId, phone: parsed.data.phone, id: { not: id } },
    })
    if (conflict) {
      return NextResponse.json({ error: 'Există deja un client cu acest număr de telefon.' }, { status: 409 })
    }
  }

  const { dateOfBirth, ...rest } = parsed.data
  await prisma.customer.update({
    where: { id },
    data: { ...rest, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : dateOfBirth === '' ? null : undefined },
  })

  return NextResponse.json({ success: true })
}
