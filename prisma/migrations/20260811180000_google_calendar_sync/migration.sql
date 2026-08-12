ALTER TABLE "Booking"
ADD COLUMN "googleCalendarEventId" TEXT,
ADD COLUMN "googleCalendarSyncedAt" TIMESTAMP(3),
ADD COLUMN "googleCalendarSyncError" TEXT;

CREATE TABLE "GoogleCalendarConnection" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "practitionerId" TEXT NOT NULL,
  "googleEmail" TEXT, "calendarId" TEXT NOT NULL, "calendarName" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL, "refreshToken" TEXT, "expiresAt" TIMESTAMP(3),
  "syncEnabled" BOOLEAN NOT NULL DEFAULT true, "includeCustomerDetails" BOOLEAN NOT NULL DEFAULT false,
  "lastSyncAt" TIMESTAMP(3), "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GoogleCalendarConnection_practitionerId_key" ON "GoogleCalendarConnection"("practitionerId");
CREATE INDEX "GoogleCalendarConnection_businessId_idx" ON "GoogleCalendarConnection"("businessId");
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
