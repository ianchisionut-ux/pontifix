import { prisma } from '@/lib/prisma'

let ready: Promise<void> | null = null

export function ensureMessageStorage() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CustomerMessage" (
      "id" TEXT NOT NULL,
      "businessId" TEXT,
      "name" TEXT NOT NULL,
      "email" TEXT,
      "phone" TEXT,
      "message" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'NEW',
      "internalNote" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CustomerMessage_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "CustomerMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`).then(async () => {
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CustomerMessage_businessId_status_idx" ON "CustomerMessage"("businessId", "status")`)
    }).catch((error) => { ready = null; throw error })
  }
  return ready
}
