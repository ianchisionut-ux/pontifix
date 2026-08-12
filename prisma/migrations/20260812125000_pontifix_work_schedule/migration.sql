ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "break1Start" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "break1End" TEXT;

CREATE TABLE IF NOT EXISTS "WorkingHours" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  CONSTRAINT "WorkingHours_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkingHours_businessId_weekday_idx" ON "WorkingHours"("businessId", "weekday");

DO $$
BEGIN
  ALTER TABLE "WorkingHours" ADD CONSTRAINT "WorkingHours_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
