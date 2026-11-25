import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ConnectionsWorkspace } from '@/components/connections/connections-workspace'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema, type ConnectionCaseDto } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { syncOfferConnectionTypes } from '@/lib/offer-connection-sync'
import { listConnectionReceptions } from '@/lib/connection-reception-storage'
import { deerSubmissionSchema } from '@/lib/deer-submission'
import { listProjectDeerRegistry, type ProjectDeerRegisterRow } from '@/lib/project-deer-registry'

export const dynamic = 'force-dynamic'

export default async function ConnectionsPage() {
  const access = await getConnectionAccess()
  if (!access) redirect('/login')
  await Promise.all([ensureConnectionStorage(), ensureQuoteStorage()])
  await syncOfferConnectionTypes(access.businessId)
  const [rows, receptions, projectRows, projectRegistry] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; sequenceNumber: number; nib: string; status: ConnectionCaseDto['status']; quoteRequestId: string | null; deerSubmittedAt: Date | null; deerSubmission: unknown; fields: unknown; atrPathname: string | null; atrName: string | null; createdByEmail: string | null; createdAt: Date; updatedAt: Date }>>`
    SELECT "id", "sequenceNumber", "nib", "status", "quoteRequestId", "deerSubmittedAt", "deerSubmission", "fields", "atrPathname", "atrName", "createdByEmail", "createdAt", "updatedAt"
    FROM "ConnectionCase" WHERE "businessId"=${access.businessId}
    ORDER BY EXTRACT(YEAR FROM "createdAt") DESC, "sequenceNumber" DESC, "createdAt" DESC
  `,
    listConnectionReceptions(access.businessId),
    prisma.project.findMany({ where: { businessId: access.businessId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, beneficiary: true, createdAt: true } }),
    listProjectDeerRegistry(access.businessId),
  ])
  const cases: ConnectionCaseDto[] = rows.map((row) => ({
    ...row,
    fields: connectionFieldsSchema.parse(row.fields),
    deerSubmission: deerSubmissionSchema.parse(row.deerSubmission || {}),
    deerSubmittedAt: row.deerSubmittedAt?.toISOString().slice(0, 10) || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
  const projectRegisterRows: ProjectDeerRegisterRow[] = projectRows.map((row) => ({
    id: row.id, name: row.name, beneficiary: row.beneficiary || '',
    createdAt: row.createdAt.toISOString(), entry: projectRegistry.find((entry) => entry.projectId === row.id) || null,
  }))
  return <div className="mx-auto max-w-[1800px] p-4 lg:p-8"><ConnectionsWorkspace initialCases={cases} initialReceptions={receptions} projectRegisterRows={projectRegisterRows} canManage={access.canManage} canEditDeerDate={access.canEditDeerDate}/></div>
}
