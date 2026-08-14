import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { ensureFormStorage, type FormSubmissionDto, type FormTemplateDto } from '@/lib/ensure-form-storage'
import { FormsManager } from '@/components/forms/forms-manager'
import type { ConnectionFormOption, ProjectFormOption } from '@/components/forms/pdf-request-editor'

export const dynamic = 'force-dynamic'

export default async function FormsPage() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) redirect('/login')
  await Promise.all([ensureFormStorage(businessId), ensureConnectionStorage()])

  const [formRows, submissionRows, connectionRows, projectRows] = await Promise.all([
    prisma.$queryRaw<Array<Omit<FormTemplateDto, 'updatedAt'> & { updatedAt: Date }>>`
      SELECT "id", "title", "category", "documentPathname", "documentName", "sortOrder", "fieldSchema", "updatedAt"
      FROM "FormTemplate" WHERE "businessId"=${businessId} ORDER BY "category", "sortOrder", "createdAt"`,
    prisma.$queryRaw<Array<Omit<FormSubmissionDto, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }>>`
      SELECT "id", "formTemplateId", "title", "sourceType", "sourceId", "values", "fieldSchema", "createdAt", "updatedAt"
      FROM "FormSubmission" WHERE "businessId"=${businessId} ORDER BY "updatedAt" DESC`,
    prisma.$queryRaw<Array<{ id: string; nib: string; fields: Record<string, string> }>>`
      SELECT "id", "nib", "fields" FROM "ConnectionCase" WHERE "businessId"=${businessId} ORDER BY "sequenceNumber" DESC`,
    prisma.project.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, beneficiary: true, beneficiaryPhone: true, address: true, certificateNumber: true, certificateDate: true } }),
  ])

  const forms: FormTemplateDto[] = formRows.map((row) => ({ ...row, fieldSchema: Array.isArray(row.fieldSchema) ? row.fieldSchema : [], updatedAt: row.updatedAt.toISOString() }))
  const submissions: FormSubmissionDto[] = submissionRows.map((row) => ({ ...row, values: row.values || {}, fieldSchema: Array.isArray(row.fieldSchema) ? row.fieldSchema : [], createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))
  const connections: ConnectionFormOption[] = connectionRows.map((row) => ({ id: row.id, nib: row.nib, fields: row.fields || {} }))
  const projects: ProjectFormOption[] = projectRows.map((row) => ({ id: row.id, name: row.name, beneficiary: row.beneficiary || '', beneficiaryPhone: row.beneficiaryPhone || '', address: row.address || '', certificateNumber: row.certificateNumber || '', certificateDate: row.certificateDate?.toLocaleDateString('ro-RO') || '' }))

  return <div className="mx-auto max-w-[1800px] p-4 lg:p-8"><FormsManager initialForms={forms} initialSubmissions={submissions} connections={connections} projects={projects} canManage={(session as any)?.role === 'SUPER_ADMIN'}/></div>
}
