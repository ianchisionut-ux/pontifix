import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Parola trebuie să aibă minim 8 caractere.'),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors.newPassword?.[0] ?? 'Date invalide.' }, { status: 400 })
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { token: parsed.data.token } })
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Linkul a expirat sau a fost deja folosit. Cere unul nou.' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10)

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])

  return NextResponse.json({ success: true })
}
