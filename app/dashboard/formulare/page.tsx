import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { ensureFormStorage, type FormSubmissionDto, type FormTemplateDto } from '@/lib/ensure-form-storage'
import { FormsManager } from '@/components/forms/forms-manager'
import type { ConnectionFormOption, ProjectFormOption } from '@/components/forms/pdf-request-editor'
import { listIdentityCards } from '@/lib/identity-card-storage'
import { listDeerBorderouri } from '@/lib/deer-borderou'
import type { DeerBorderouDto } from '@/lib/deer-borderou-shared'

export const dynamic = 'force-dynamic'

type SubmissionRow = Omit<FormSubmissionDto, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }

export default async function FormsPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) redirect('/login')
  const canAccessIdentityData = (session as any)?.role !== 'STAFF'
  await Promise.all([ensureFormStorage(businessId), ensureConnectionStorage()])

  // STAFF may browse form templates, but saved values can contain CNP and
  // other identity-card fields. Exclude identity-bound records at the query
  // boundary and strip every editable payload from the remaining metadata.
  const submissionRowsPromise = canAccessIdentityData
    ? prisma.$queryRaw<SubmissionRow[]>`
        SELECT "id", "formTemplateId", "title", "sourceType", "sourceId", "values", "fieldSchema", "stampSchema", "createdAt", "updatedAt"
        FROM "FormSubmission" WHERE "businessId"=${businessId} ORDER BY "updatedAt" DESC`
    : prisma.$queryRaw<SubmissionRow[]>`
        SELECT "id", "formTemplateId", "title",
          NULL::text AS "sourceType", NULL::text AS "sourceId",
          '{}'::jsonb AS "values", '[]'::jsonb AS "fieldSchema", '[]'::jsonb AS "stampSchema",
          "createdAt", "updatedAt"
        FROM "FormSubmission"
        WHERE "businessId"=${businessId}
          AND COALESCE(UPPER(BTRIM("sourceType")), '') NOT LIKE 'IDENTITY%'
          AND COALESCE(UPPER(BTRIM("sourceType")), '') <> 'CI'
        ORDER BY "updatedAt" DESC`

  const [formRows, submissionRows, connectionRows, projectRows, identityCards, borderouRows] = await Promise.all([
    prisma.$queryRaw<Array<Omit<FormTemplateDto, 'updatedAt' | 'deletedAt'> & { updatedAt: Date; deletedAt: Date | null }>>`
      SELECT "id", "title", "category", "documentPathname", "documentName", "deerDocumentKind", "sortOrder", "fieldSchema", "stampSchema", "updatedAt", "deletedAt"
      FROM "FormTemplate" WHERE "businessId"=${businessId} ORDER BY "category", "sortOrder", "createdAt"`,
    submissionRowsPromise,
    prisma.$queryRaw<Array<{ id: string; nib: string; sequenceNumber: number; status: string; deerSubmittedAt: Date | null; createdAt: Date; fields: Record<string, string> }>>`
      SELECT "id", "nib", "sequenceNumber", "status", "deerSubmittedAt", "createdAt", "fields" FROM "ConnectionCase" WHERE "businessId"=${businessId} ORDER BY "sequenceNumber" DESC`,
    prisma.project.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, beneficiary: true, beneficiaryPhone: true, address: true, certificateNumber: true, certificateDate: true } }),
    canAccessIdentityData ? listIdentityCards(businessId) : Promise.resolve([]),
    listDeerBorderouri(businessId),
  ])

  const forms: FormTemplateDto[] = formRows.map((row) => ({ ...row, fieldSchema: Array.isArray(row.fieldSchema) ? row.fieldSchema : [], stampSchema: Array.isArray(row.stampSchema) ? row.stampSchema : [], updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() || null }))
  const submissions: FormSubmissionDto[] = submissionRows.map((row) => ({
    ...row,
    sourceType: canAccessIdentityData ? row.sourceType : null,
    sourceId: canAccessIdentityData ? row.sourceId : null,
    values: canAccessIdentityData ? row.values || {} : {},
    fieldSchema: canAccessIdentityData && Array.isArray(row.fieldSchema) ? row.fieldSchema : [],
    stampSchema: canAccessIdentityData && Array.isArray(row.stampSchema) ? row.stampSchema : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
  const connections: ConnectionFormOption[] = connectionRows.map((row) => ({ id: row.id, nib: row.nib, sequenceNumber: row.sequenceNumber, status: row.status, deerSubmittedAt: row.deerSubmittedAt?.toISOString().slice(0, 10) || '', createdAt: row.createdAt.toLocaleDateString('ro-RO'), fields: row.fields || {} }))
  const projects: ProjectFormOption[] = projectRows.map((row) => ({ id: row.id, name: row.name, beneficiary: row.beneficiary || '', beneficiaryPhone: row.beneficiaryPhone || '', address: row.address || '', certificateNumber: row.certificateNumber || '', certificateDate: row.certificateDate?.toLocaleDateString('ro-RO') || '' }))
  const borderouri: DeerBorderouDto[] = borderouRows.map(({ documentPathname: _pathname, ...row }) => ({ ...row, receivedAt: row.receivedAt.toISOString() }))

  return <div className="mx-auto max-w-[1800px] p-4 lg:p-8"><FormsManager initialForms={forms} initialSubmissions={submissions} connections={connections} projects={projects} identityCards={identityCards} borderouri={borderouri} canManage={(session as any)?.role === 'SUPER_ADMIN'} canEdit={(session as any)?.role !== 'STAFF'}/></div>
}
