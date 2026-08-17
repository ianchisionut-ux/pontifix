import { prisma } from '@/lib/prisma'

let ready: Promise<void> | null = null

export function ensureInternalChatStorage() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "InternalChatMessage" (
      "id" TEXT NOT NULL,
      "businessId" TEXT NOT NULL,
      "senderId" TEXT NOT NULL,
      "recipientId" TEXT,
      "text" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InternalChatMessage_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "InternalChatMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "InternalChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "InternalChatMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`).then(async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "InternalChatReceipt" (
        "messageId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "readAt" TIMESTAMP(3),
        CONSTRAINT "InternalChatReceipt_pkey" PRIMARY KEY ("messageId", "userId"),
        CONSTRAINT "InternalChatReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InternalChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "InternalChatReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`)
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "InternalChatProfile" (
        "userId" TEXT NOT NULL,
        "businessId" TEXT NOT NULL,
        "displayName" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InternalChatProfile_pkey" PRIMARY KEY ("userId"),
        CONSTRAINT "InternalChatProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "InternalChatProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InternalChatMessage_business_created_idx" ON "InternalChatMessage"("businessId", "createdAt")`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InternalChatReceipt_user_read_idx" ON "InternalChatReceipt"("userId", "readAt")`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InternalChatProfile_business_idx" ON "InternalChatProfile"("businessId")`)
    }).catch((error) => { ready = null; throw error })
  }
  return ready
}