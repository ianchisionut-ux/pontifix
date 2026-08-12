DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM ('REQUIRED', 'SUBMITTED', 'OBTAINED', 'NOT_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "certificateNumber" TEXT,
  "certificateDate" DATE,
  "beneficiary" TEXT,
  "address" TEXT,
  "description" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "documentUrl" TEXT,
  "documentName" TEXT,
  "extractedText" TEXT,
  "uploadedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Project_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Project_businessId_status_idx" ON "Project"("businessId", "status");
CREATE INDEX IF NOT EXISTS "Project_businessId_updatedAt_idx" ON "Project"("businessId", "updatedAt");

CREATE TABLE IF NOT EXISTS "ProjectApproval" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "institution" TEXT,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'REQUIRED',
  "submittedAt" DATE,
  "obtainedAt" DATE,
  "notes" TEXT,
  "documentUrl" TEXT,
  "documentName" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ProjectApproval_projectId_sortOrder_idx" ON "ProjectApproval"("projectId", "sortOrder");