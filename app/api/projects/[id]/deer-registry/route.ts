import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getConnectionAccess } from '@/lib/connection-access'
import { deerSubmissionSchema } from '@/lib/deer-submission'
import { ensureProjectDeerRegistryStorage } from '@/lib/project-deer-registry'
import { prisma } from '@/lib/prisma'

const schema = z.object({ deerSubmission: deerSubmissionSchema })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canEditDeerDate) return NextResponse.json({ error: 'Nu ai acces la registrul DEER.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele registrului sunt invalide.' }, { status: 400 })
  const { id } = await params
  const project = await prisma.project.findFirst({ where: { id, businessId: access.businessId }, select: { id: true } })
  if (!project) return NextResponse.json({ error: 'Proiect inexistent.' }, { status: 404 })

  await ensureProjectDeerRegistryStorage()
  const submission = parsed.data.deerSubmission
  const latestDate = submission.actionHistory.reduce((latest, entry) => entry.submittedAt > latest ? entry.submittedAt : latest, '')
  const status = submission.status === 'COMPLETED' ? 'COMPLETED'
    : submission.registrationNumber ? 'REGISTERED'
      : latestDate ? 'SUBMITTED'
        : submission.lastPreparedAt ? 'READY' : 'DRAFT'
  const saved = { ...submission, status }
  const submittedAt = latestDate ? new Date(`${latestDate}T00:00:00.000Z`) : null
  await prisma.$executeRaw`
    INSERT INTO "ProjectDeerRegistry" ("businessId", "projectId", "deerSubmission", "deerSubmittedAt")
    VALUES (${access.businessId}, ${id}, ${JSON.stringify(saved)}::jsonb, ${submittedAt})
    ON CONFLICT ("businessId", "projectId") DO UPDATE SET
      "deerSubmission"=EXCLUDED."deerSubmission", "deerSubmittedAt"=EXCLUDED."deerSubmittedAt", "updatedAt"=CURRENT_TIMESTAMP`
  revalidatePath('/dashboard/formulare')
  return NextResponse.json({ projectId: id, deerSubmission: saved, deerSubmittedAt: latestDate || null })
}
