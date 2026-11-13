import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureInternalChatStorage } from '@/lib/ensure-internal-chat-storage'
import { requireUserAdministrator } from '@/lib/user-administration'

const updateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit'), email: z.string().trim().email().max(254), displayName: z.string().trim().min(2).max(60), role: z.enum(['STAFF', 'OWNER', 'SUPER_ADMIN']) }),
  z.object({ action: z.literal('resetPassword') }),
  z.object({ action: z.literal('restore') }),
])

async function target(id: string, businessId: string) {
  return prisma.user.findFirst({ where: { id, businessId }, select: { id: true, email: true, role: true } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireUserAdministrator()
  if (!admin) return NextResponse.json({ error: 'Doar superadminul poate modifica conturi.' }, { status: 403 })
  const { id } = await params
  const user = await target(id, admin.businessId)
  if (!user) return NextResponse.json({ error: 'Contul nu există.' }, { status: 404 })
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele contului nu sunt valide.' }, { status: 400 })
  if (parsed.data.action === 'resetPassword') {
    const password = randomBytes(18).toString('base64url')
    await prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(password, 12) } })
    await prisma.passwordResetToken.deleteMany({ where: { userId: id } })
    return NextResponse.json({ success: true, temporaryPassword: password })
  }
  if (parsed.data.action === 'restore') {
    await prisma.$executeRaw`UPDATE "UserAccessStatus" SET "disabledAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = ${id}`
    return NextResponse.json({ success: true })
  }
  if ((id === admin.userId || user.email === 'ianchisionut@gmail.com') && (parsed.data.role !== 'SUPER_ADMIN' || parsed.data.email.toLowerCase() !== user.email)) {
    return NextResponse.json({ error: 'Nu îți poți elimina propriul acces de superadmin sau modifica e-mailul de autentificare aici.' }, { status: 400 })
  }
  const email = parsed.data.email.toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing && existing.id !== id) return NextResponse.json({ error: 'Adresa de e-mail este deja folosită.' }, { status: 409 })
  await ensureInternalChatStorage()
  await prisma.user.update({ where: { id }, data: { email, role: parsed.data.role } })
  await prisma.$executeRaw`INSERT INTO "InternalChatProfile" ("userId", "businessId", "displayName")
    VALUES (${id}, ${admin.businessId}, ${parsed.data.displayName})
    ON CONFLICT ("userId") DO UPDATE SET "displayName" = EXCLUDED."displayName", "updatedAt" = CURRENT_TIMESTAMP`
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireUserAdministrator()
  if (!admin) return NextResponse.json({ error: 'Doar superadminul poate șterge conturi.' }, { status: 403 })
  const { id } = await params
  if (id === admin.userId) return NextResponse.json({ error: 'Nu îți poți șterge propriul cont.' }, { status: 400 })
  const user = await target(id, admin.businessId)
  if (!user) return NextResponse.json({ error: 'Contul nu există.' }, { status: 404 })
  if (user?.email === 'ianchisionut@gmail.com') return NextResponse.json({ error: 'Contul principal de superadmin nu poate fi șters.' }, { status: 400 })
  await prisma.$executeRaw`INSERT INTO "UserAccessStatus" ("userId", "disabledAt", "updatedAt")
    VALUES (${id}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET "disabledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP`
  await prisma.passwordResetToken.deleteMany({ where: { userId: id } })
  return NextResponse.json({ success: true })
}
