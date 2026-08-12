CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR');
CREATE TYPE "TimeEntrySource" AS ENUM ('WEB', 'MANUAL');
CREATE TYPE "LeaveType" AS ENUM ('VACATION', 'MEDICAL', 'PERSONAL', 'UNPAID');
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "AttendanceEmployee" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "userId" TEXT,
  "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL, "email" TEXT,
  "phone" TEXT, "position" TEXT, "department" TEXT,
  "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
  "weeklyHours" DOUBLE PRECISION NOT NULL DEFAULT 40,
  "active" BOOLEAN NOT NULL DEFAULT true, "hiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceEmployee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeEntry" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "clockIn" TIMESTAMP(3) NOT NULL, "clockOut" TIMESTAMP(3), "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  "source" "TimeEntrySource" NOT NULL DEFAULT 'WEB', "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveRequest" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "type" "LeaveType" NOT NULL, "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT, "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceEmployee_userId_key" ON "AttendanceEmployee"("userId");
CREATE UNIQUE INDEX "AttendanceEmployee_businessId_email_key" ON "AttendanceEmployee"("businessId", "email");
CREATE INDEX "AttendanceEmployee_businessId_active_idx" ON "AttendanceEmployee"("businessId", "active");
CREATE INDEX "TimeEntry_businessId_clockIn_idx" ON "TimeEntry"("businessId", "clockIn");
CREATE INDEX "TimeEntry_employeeId_clockIn_idx" ON "TimeEntry"("employeeId", "clockIn");
CREATE INDEX "LeaveRequest_businessId_status_idx" ON "LeaveRequest"("businessId", "status");
CREATE INDEX "LeaveRequest_employeeId_startDate_idx" ON "LeaveRequest"("employeeId", "startDate");

ALTER TABLE "AttendanceEmployee" ADD CONSTRAINT "AttendanceEmployee_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceEmployee" ADD CONSTRAINT "AttendanceEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "AttendanceEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "AttendanceEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
