import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { ensureInternalChatStorage } from '@/lib/ensure-internal-chat-storage'
import { ensureUserAdministrationStorage, requireUserAdministrator } from '@/lib/user-administration'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(2).max(60),
  role: z.enum(['STAFF', 'OWNER', 'SUPER_ADMIN']),
})

export async function GET() {
  const admin = await requireUserAdministrator()
  if (!admin) return NextResponse.json({ error: 'Doar superadminul poate vedea conturile.' }, { status: 403 })
  await ensureInternalChatStorage()
  const users = await prisma.$queryRaw<Array<{ id: string; email: string; role: string; displayName: string; disabledAt: Date | null }>>`
    SELECT u."id", u."email", u."role"::text AS "role",
      COALESCE(p."displayName", split_part(u."email", '@', 1)) AS "displayName", s."disabledAt"
    FROM "User" u
    LEFT JOIN "InternalChatProfile" p ON p."userId" = u."id"
    LEFT JOIN "UserAccessStatus" s ON s."userId" = u."id"
    WHERE u."businessId" = ${admin.businessId}
    ORDER BY s."disabledAt" NULLS FIRST, u."email" ASC
  `
  return NextResponse.json({ users: users.map((user) => ({ ...user, disabledAt: user.disabledAt?.toISOString() ?? null })), currentUserId: admin.userId })
}

export async function POST(request: NextRequest) {
  const admin = await requireUserAdministrator()
  if (!admin) return NextResponse.json({ error: 'Doar superadminul poate crea conturi.' }, { status: 403 })
  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Completează un nume, e-mail și rol valide.' }, { status: 400 })
  const email = parsed.data.email.toLowerCase()
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: 'Această adresă aparține deja unui cont.' }, { status: 409 })
  }
  const password = randomBytes(18).toString('base64url')
  const passwordHash = await bcrypt.hash(password, 12)
  await ensureUserAdministrationStorage()
  await ensureInternalChatStorage()
  const user = await prisma.user.create({
    data: { email, password: passwordHash, role: parsed.data.role, businessId: admin.businessId },
    select: { id: true, email: true, role: true },
  })
  await prisma.$executeRaw`INSERT INTO "InternalChatProfile" ("userId", "businessId", "displayName")
    VALUES (${user.id}, ${admin.businessId}, ${parsed.data.displayName})
    ON CONFLICT ("userId") DO UPDATE SET "displayName" = EXCLUDED."displayName", "updatedAt" = CURRENT_TIMESTAMP`
  return NextResponse.json({ user: { ...user, displayName: parsed.data.displayName, disabledAt: null }, temporaryPassword: password }, { status: 201 })
}
