import { prisma } from '@/lib/prisma'

let ready: Promise<void> | null = null

export function ensureProjectAuthorizationStorage() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`
      ALTER TABLE "Project"
      ADD COLUMN IF NOT EXISTS "authorizationDocumentUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "authorizationDocumentName" TEXT,
      ADD COLUMN IF NOT EXISTS "contractSigned" BOOLEAN NOT NULL DEFAULT false
    `).then(() => undefined).catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}
