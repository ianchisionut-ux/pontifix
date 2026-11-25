import { prisma } from '@/lib/prisma'
import { defaultDeerSubmission, deerSubmissionSchema, type DeerSubmission } from '@/lib/deer-submission'

export type ProjectDeerRegistryEntry = {
  projectId: string
  deerSubmission: DeerSubmission
  deerSubmittedAt: string | null
}

export type ProjectDeerRegisterRow = {
  id: string
  name: string
  beneficiary: string
  createdAt: string
  entry: ProjectDeerRegistryEntry | null
}

let storageReady: Promise<void> | null = null

export async function ensureProjectDeerRegistryStorage() {
  if (!storageReady) {
    storageReady = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ProjectDeerRegistry" (
      "businessId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "deerSubmission" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "deerSubmittedAt" DATE,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProjectDeerRegistry_pkey" PRIMARY KEY ("businessId", "projectId"),
      CONSTRAINT "ProjectDeerRegistry_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
    )`).then(() => undefined).catch((error) => { storageReady = null; throw error })
  }
  await storageReady
}

export async function listProjectDeerRegistry(businessId: string): Promise<ProjectDeerRegistryEntry[]> {
  await ensureProjectDeerRegistryStorage()
  const rows = await prisma.$queryRaw<Array<{ projectId: string; deerSubmission: unknown; deerSubmittedAt: Date | null }>>`
    SELECT "projectId", "deerSubmission", "deerSubmittedAt" FROM "ProjectDeerRegistry" WHERE "businessId"=${businessId}`
  return rows.map((row) => ({
    projectId: row.projectId,
    deerSubmission: deerSubmissionSchema.safeParse(row.deerSubmission).data || defaultDeerSubmission(),
    deerSubmittedAt: row.deerSubmittedAt?.toISOString().slice(0, 10) || null,
  }))
}
