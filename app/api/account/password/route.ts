import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Parola nouă trebuie să aibă minim 8 caractere.'),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const userId = (session as any).userId
  if (!userId) return NextResponse.json({ error: 'Sesiune invalidă — reloghează-te.' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors.newPassword?.[0] ?? 'Date invalide.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Cont negăsit.' }, { status: 404 })

  const currentValid = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!currentValid) {
    return NextResponse.json({ error: 'Parola actuală e greșită.' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10)
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } })

  return NextResponse.json({ success: true })
}
