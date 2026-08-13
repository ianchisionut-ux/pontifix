import { prisma } from '@/lib/prisma'

let ready: Promise<void> | null = null

export function ensureWhatsAppStorage() {
  if (!ready) {
    ready = (async () => {
      await prisma.$executeRawUnsafe(`DO $$ BEGIN
        CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE_BUSINESS', 'WEB', 'MANUAL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;`)
      await prisma.$executeRawUnsafe(`DO $$ BEGIN
        CREATE TYPE "ChannelStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'DISCONNECTED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;`)
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Channel" (
        "id" TEXT NOT NULL,
        "businessId" TEXT NOT NULL,
        "type" "ChannelType" NOT NULL,
        "externalId" TEXT NOT NULL,
        "wabaId" TEXT,
        "accessToken" TEXT NOT NULL,
        "refreshToken" TEXT,
        "expiresAt" TIMESTAMP(3),
        "status" "ChannelStatus" NOT NULL DEFAULT 'ACTIVE',
        "enabledByOwner" BOOLEAN NOT NULL DEFAULT true,
        "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Channel_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Channel_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )`)
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Channel_type_externalId_key" ON "Channel"("type", "externalId")`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Channel_businessId_type_idx" ON "Channel"("businessId", "type")`)
    })().catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}
