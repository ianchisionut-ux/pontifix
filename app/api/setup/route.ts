import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  companyName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(100),
})

export async function GET() {
  const count = await prisma.user.count()
  return NextResponse.json({ setupAvailable: count === 0 })
}

export async function POST(req: NextRequest) {
  if (await prisma.user.count()) return NextResponse.json({ error: 'Configurarea inițială a fost deja făcută.' }, { status: 409 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Completează corect toate câmpurile. Parola trebuie să aibă minimum 10 caractere.' }, { status: 400 })
  const { companyName, email, password } = parsed.data
  const slug = companyName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'companie'
  await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({ data: { name: companyName, slug: `${slug}-${Date.now().toString().slice(-5)}`, category: 'SALON', onboardingDone: true, accountActive: true, publicListed: false } })
    const user = await tx.user.create({ data: { email, password: await bcrypt.hash(password, 12), role: 'OWNER', businessId: business.id } })
    await tx.attendanceEmployee.create({ data: { businessId: business.id, userId: user.id, email, firstName: 'Administrator', lastName: companyName, position: 'Administrator' } })
  })
  return NextResponse.json({ success: true }, { status: 201 })
}
