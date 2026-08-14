ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "authorizationDocumentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "authorizationDocumentName" TEXT;
