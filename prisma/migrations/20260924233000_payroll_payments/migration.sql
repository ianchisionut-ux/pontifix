DO $$ BEGIN
  CREATE TYPE "PayrollPaymentType" AS ENUM ('NET_SALARIES','CAS','CASS','INCOME_TAX','CAM','OTHER_DEDUCTIONS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollPaymentMethod" AS ENUM ('BANK','CASH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PayrollPayment" (
  "id" TEXT PRIMARY KEY,
  "payrollRunId" TEXT NOT NULL REFERENCES "PayrollRun"("id") ON DELETE CASCADE,
  "type" "PayrollPaymentType" NOT NULL,
  "method" "PayrollPaymentMethod" NOT NULL DEFAULT 'BANK',
  "amount" DOUBLE PRECISION NOT NULL CHECK ("amount" > 0),
  "paidAt" DATE NOT NULL,
  "journalEntryId" INTEGER,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollPayment_payrollRunId_type_key" UNIQUE ("payrollRunId", "type")
);

CREATE INDEX IF NOT EXISTS "PayrollPayment_paidAt_idx" ON "PayrollPayment"("paidAt");
