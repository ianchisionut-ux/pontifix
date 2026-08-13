ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "businessId" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "estimatedValue" DOUBLE PRECISION;
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "QuoteRequest_businessId_createdAt_idx" ON "QuoteRequest"("businessId", "createdAt");
