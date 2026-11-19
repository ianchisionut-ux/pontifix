import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

let ready: Promise<void> | null = null

export function ensureUserAdministrationStorage() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserAccessStatus" (
      "userId" TEXT NOT NULL PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
      "disabledAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).then(() => undefined).catch((error) => { ready = null; throw error })
  }
  return ready
}

export async function getUserAccess(userId: string) {
  await ensureUserAdministrationStorage()
  const rows = await prisma.$queryRaw<Array<{ id: string; email: string; role: string; businessId: string | null; disabledAt: Date | null; accessUpdatedAt: Date | null }>>`
    SELECT u."id", u."email", u."role"::text AS "role", u."businessId", s."disabledAt", s."updatedAt" AS "accessUpdatedAt"
    FROM "User" u LEFT JOIN "UserAccessStatus" s ON s."userId" = u."id"
    WHERE u."id" = ${userId} LIMIT 1
  `
  return rows[0] ?? null
}

type AccessExecutor = Pick<Prisma.TransactionClient, '$executeRaw'>

export async function invalidateUserSessions(userId: string, executor: AccessExecutor = prisma) {
  await ensureUserAdministrationStorage()
  await executor.$executeRaw`INSERT INTO "UserAccessStatus" ("userId", "disabledAt", "updatedAt")
    VALUES (${userId}, NULL, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET "updatedAt" = GREATEST(CURRENT_TIMESTAMP::timestamp, "UserAccessStatus"."updatedAt" + INTERVAL '1 millisecond')`
}

export async function requireUserAdministrator() {
  const { auth } = await import('@/lib/auth')
  const session = await auth()
  const userId = (session as { userId?: string } | null)?.userId
  if (!userId) return null
  const user = await getUserAccess(userId)
  if (!user || user.disabledAt || user.role !== 'SUPER_ADMIN' || !user.businessId) return null
  return { userId: user.id, businessId: user.businessId, email: user.email }
}
