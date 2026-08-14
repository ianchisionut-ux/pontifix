import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ConnectionsManager } from '@/components/connections/connections-manager'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema, type ConnectionCaseDto } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'

export const dynamic = 'force-dynamic'

export default async function ConnectionsPage() {
  const access = await getConnectionAccess()
  if (!access) redirect('/login')
  await ensureConnectionStorage()
  const rows = await prisma.$queryRaw<Array<{ id: string; fields: unknown; atrPathname: string | null; atrName: string | null; createdByEmail: string | null; createdAt: Date; updatedAt: Date }>>`
    SELECT "id", "fields", "atrPathname", "atrName", "createdByEmail", "createdAt", "updatedAt"
    FROM "ConnectionCase" WHERE "businessId"=${access.businessId} ORDER BY "updatedAt" DESC
  `
  const cases: ConnectionCaseDto[] = rows.map((row) => ({
    ...row,
    fields: connectionFieldsSchema.parse(row.fields),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
  return <div className="mx-auto max-w-[1800px] p-4 lg:p-8"><ConnectionsManager initialCases={cases} canManage={access.canManage}/></div>
}
