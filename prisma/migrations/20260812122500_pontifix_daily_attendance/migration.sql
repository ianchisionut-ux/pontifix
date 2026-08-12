CREATE TYPE "AttendanceDayStatus" AS ENUM ('PRESENT', 'ABSENT', 'VACATION', 'MEDICAL', 'DAY_OFF', 'REMOTE');

CREATE TABLE "DailyAttendance" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "status" "AttendanceDayStatus" NOT NULL,
  "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyAttendance_employeeId_workDate_key" ON "DailyAttendance"("employeeId", "workDate");
CREATE INDEX "DailyAttendance_businessId_workDate_idx" ON "DailyAttendance"("businessId", "workDate");

ALTER TABLE "DailyAttendance" ADD CONSTRAINT "DailyAttendance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyAttendance" ADD CONSTRAINT "DailyAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "AttendanceEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
