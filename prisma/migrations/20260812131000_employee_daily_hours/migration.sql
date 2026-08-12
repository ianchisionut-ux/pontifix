ALTER TABLE "AttendanceEmployee" ADD COLUMN IF NOT EXISTS "dailyHours" DOUBLE PRECISION NOT NULL DEFAULT 8;
UPDATE "DailyAttendance" SET "status" = 'PRESENT' WHERE "status" = 'REMOTE';
