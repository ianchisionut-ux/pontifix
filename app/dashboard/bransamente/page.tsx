import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ConnectionsWorkspace } from '@/components/connections/connections-workspace'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema, type ConnectionCaseDto } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { listConnectionReceptions } from '@/lib/connection-reception-storage'
import { deerSubmissionSchema } from '@/lib/deer-submission'

export const dynamic = 'force-dynamic'

export default async function ConnectionsPage() {
  const access = await getConnectionAccess()
  if (!access) redirect('/login')
  await ensureConnectionStorage()
  const rows = await prisma.$queryRaw<Array<{ id: string; sequenceNumber: number; nib: string; status: ConnectionCaseDto['status']; quoteRequestId: string | null; deerSubmittedAt: Date | null; deerSubmission: unknown; fields: unknown; atrPathname: string | null; atrName: string | null; createdByEmail: string | null; createdAt: Date; updatedAt: Date }>>`
    SELECT "id", "sequenceNumber", "nib", "status", "quoteRequestId", "deerSubmittedAt", "deerSubmission", "fields", "atrPathname", "atrName", "createdByEmail", "createdAt", "updatedAt"
    FROM "ConnectionCase" WHERE "businessId"=${access.businessId}
    ORDER BY EXTRACT(YEAR FROM "createdAt") DESC, "sequenceNumber" DESC, "createdAt" DESC
  `
  const cases: ConnectionCaseDto[] = rows.map((row) => ({
    ...row,
    fields: connectionFieldsSchema.parse(row.fields),
    deerSubmission: deerSubmissionSchema.parse(row.deerSubmission || {}),
    deerSubmittedAt: row.deerSubmittedAt?.toISOString().slice(0, 10) || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
  const receptions = await listConnectionReceptions(access.businessId)
  return <div className="mx-auto max-w-[1800px] p-4 lg:p-8"><ConnectionsWorkspace initialCases={cases} initialReceptions={receptions} canManage={access.canManage} canEditDeerDate={access.canEditDeerDate}/></div>
}
