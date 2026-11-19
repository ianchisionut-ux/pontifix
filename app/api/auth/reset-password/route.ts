import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureUserAdministrationStorage, invalidateUserSessions } from '@/lib/user-administration'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Parola trebuie să aibă minim 8 caractere.').max(128),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors.newPassword?.[0] ?? 'Date invalide.' }, { status: 400 })
  }

  // Reject random/expired tokens before spending CPU on bcrypt. The token is
  // still claimed atomically in the transaction below, so this is only a
  // cheap preflight and not the concurrency guard.
  const preflight = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
    select: { usedAt: true, expiresAt: true },
  })
  if (!preflight || preflight.usedAt || preflight.expiresAt <= new Date()) {
    return NextResponse.json({ error: 'Linkul a expirat sau a fost deja folosit. Cere unul nou.' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10)
  await ensureUserAdministrationStorage()
  const changed = await prisma.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({ where: { token: parsed.data.token } })
    const usedAt = new Date()
    if (!record || record.usedAt || record.expiresAt <= usedAt) return false

    // Claim the token conditionally. Concurrent requests may both read it, but
    // PostgreSQL re-checks this predicate after the row lock is released, so
    // exactly one request can consume it.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: usedAt } },
      data: { usedAt },
    })
    if (claimed.count !== 1) return false
    await tx.user.update({ where: { id: record.userId }, data: { password: hashed } })
    await invalidateUserSessions(record.userId, tx)
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, id: { not: record.id }, usedAt: null },
      data: { usedAt },
    })
    return true
  })
  if (!changed) {
    return NextResponse.json({ error: 'Linkul a expirat sau a fost deja folosit. Cere unul nou.' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
