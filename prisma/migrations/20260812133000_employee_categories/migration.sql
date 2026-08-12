DO $$
BEGIN
  CREATE TYPE "EmployeeCategory" AS ENUM ('TESA', 'PRODUCTIE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AttendanceEmployee"
  ADD COLUMN IF NOT EXISTS "category" "EmployeeCategory" NOT NULL DEFAULT 'PRODUCTIE',
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "AttendanceEmployee"
SET "category" = 'TESA'
WHERE lower(COALESCE("position", '')) = 'administrator';

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "category"
    ORDER BY LOWER("lastName"), LOWER("firstName")
  ) - 1 AS position
  FROM "AttendanceEmployee"
)
UPDATE "AttendanceEmployee" employee
SET "sortOrder" = ranked.position
FROM ranked
WHERE employee."id" = ranked."id";

ALTER TABLE "DailyAttendance"
  ADD COLUMN IF NOT EXISTS "leaveRequestId" TEXT;

CREATE INDEX IF NOT EXISTS "DailyAttendance_leaveRequestId_idx"
  ON "DailyAttendance"("leaveRequestId");

INSERT INTO "DailyAttendance" (
  "id", "businessId", "employeeId", "workDate", "status", "hours",
  "leaveRequestId", "createdAt", "updatedAt"
)
SELECT
  'leave-' || SUBSTRING(MD5(request."id" || day::TEXT), 1, 24),
  request."businessId",
  request."employeeId",
  day::DATE,
  CASE
    WHEN request."type" = 'VACATION' THEN 'VACATION'::"AttendanceDayStatus"
    WHEN request."type" = 'MEDICAL' THEN 'MEDICAL'::"AttendanceDayStatus"
    ELSE 'DAY_OFF'::"AttendanceDayStatus"
  END,
  0,
  request."id",
  NOW(),
  NOW()
FROM "LeaveRequest" request
CROSS JOIN LATERAL generate_series(
  request."startDate"::DATE,
  request."endDate"::DATE,
  INTERVAL '1 day'
) day
WHERE request."status" = 'APPROVED'
ON CONFLICT ("employeeId", "workDate") DO NOTHING;

