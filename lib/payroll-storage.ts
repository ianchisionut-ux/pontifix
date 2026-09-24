import { prisma } from './prisma'

declare global {
  // eslint-disable-next-line no-var
  var __payrollSchemaReady: Promise<void> | undefined
}

async function createPayrollSchema() {
  const statements = [
    `ALTER TABLE "AttendanceEmployee" ADD COLUMN IF NOT EXISTS "cnp" TEXT`,
    `ALTER TABLE "AttendanceEmployee" ADD COLUMN IF NOT EXISTS "contractNumber" TEXT`,
    `ALTER TABLE "AttendanceEmployee" ADD COLUMN IF NOT EXISTS "contractDate" DATE`,
    `ALTER TABLE "AttendanceEmployee" ADD COLUMN IF NOT EXISTS "grossSalary" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `ALTER TABLE "AttendanceEmployee" ADD COLUMN IF NOT EXISTS "baseFunction" BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE "AttendanceEmployee" ADD COLUMN IF NOT EXISTS "dependents" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "AttendanceEmployee" ADD COLUMN IF NOT EXISTS "personalDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0`,
    `ALTER TABLE "AttendanceEmployee" ADD COLUMN IF NOT EXISTS "iban" TEXT`,
    `ALTER TABLE "AttendanceEmployee" ADD COLUMN IF NOT EXISTS "sagaExternalId" TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceEmployee_businessId_cnp_key" ON "AttendanceEmployee" ("businessId", "cnp") WHERE "cnp" IS NOT NULL AND "cnp" <> ''`,
    `CREATE INDEX IF NOT EXISTS "AttendanceEmployee_businessId_contractNumber_idx" ON "AttendanceEmployee" ("businessId", "contractNumber")`,
    `DO $$ BEGIN CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'FINALIZED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `CREATE TABLE IF NOT EXISTS "PayrollRun" (
      "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
      "month" TEXT NOT NULL, "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
      "minimumGross" DOUBLE PRECISION NOT NULL, "nonTaxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "casRate" DOUBLE PRECISION NOT NULL DEFAULT 25, "cassRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
      "incomeTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 10, "camRate" DOUBLE PRECISION NOT NULL DEFAULT 2.25,
      "notes" TEXT, "finalizedAt" TIMESTAMP(3), "finalizedBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PayrollRun_businessId_month_key" UNIQUE ("businessId", "month"))`,
    `CREATE INDEX IF NOT EXISTS "PayrollRun_businessId_status_idx" ON "PayrollRun" ("businessId", "status")`,
    `CREATE TABLE IF NOT EXISTS "PayrollLine" (
      "id" TEXT PRIMARY KEY, "payrollRunId" TEXT NOT NULL REFERENCES "PayrollRun"("id") ON DELETE CASCADE,
      "employeeId" TEXT NOT NULL REFERENCES "AttendanceEmployee"("id") ON DELETE RESTRICT,
      "workingDays" INTEGER NOT NULL, "workedDays" DOUBLE PRECISION NOT NULL, "vacationDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "medicalDays" DOUBLE PRECISION NOT NULL DEFAULT 0, "unpaidDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "workedHours" DOUBLE PRECISION NOT NULL DEFAULT 0, "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "baseGross" DOUBLE PRECISION NOT NULL, "attendanceGross" DOUBLE PRECISION NOT NULL,
      "overtimeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "bonuses" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "medicalAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0, "taxableBenefits" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "mealTickets" DOUBLE PRECISION NOT NULL DEFAULT 0, "nonTaxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "grossIncome" DOUBLE PRECISION NOT NULL, "cas" DOUBLE PRECISION NOT NULL, "cass" DOUBLE PRECISION NOT NULL,
      "personalDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0, "taxableBase" DOUBLE PRECISION NOT NULL,
      "incomeTax" DOUBLE PRECISION NOT NULL, "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "advancePaid" DOUBLE PRECISION NOT NULL DEFAULT 0, "netSalary" DOUBLE PRECISION NOT NULL,
      "cam" DOUBLE PRECISION NOT NULL, "employerCost" DOUBLE PRECISION NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'CALCULATED', "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PayrollLine_payrollRunId_employeeId_key" UNIQUE ("payrollRunId", "employeeId"))`,
    `CREATE INDEX IF NOT EXISTS "PayrollLine_employeeId_idx" ON "PayrollLine" ("employeeId")`,
  ]
  for (const statement of statements) await prisma.$executeRawUnsafe(statement)
}

export async function ensurePayrollSchema() {
  if (!global.__payrollSchemaReady) {
    global.__payrollSchemaReady = createPayrollSchema().catch((error) => {
      global.__payrollSchemaReady = undefined
      throw error
    })
  }
  await global.__payrollSchemaReady
}
