import { prisma } from '@/lib/prisma'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { CONNECTION_STATUS_META, isConnectionStatus, type ConnectionStatus } from '@/lib/connection-status'
import type { ConnectionStatsData } from '@/components/connections/connection-stats'

export async function getConnectionStatistics(businessId: string): Promise<ConnectionStatsData> {
  await ensureConnectionStorage()
  const rows = await prisma.$queryRaw<Array<{ status: string; count: number }>>`
    SELECT "status", COUNT(*)::int AS "count" FROM "ConnectionCase" WHERE "businessId"=${businessId} GROUP BY "status"
  `
  const byStatus = rows.filter((row): row is { status: ConnectionStatus; count: number } => isConnectionStatus(row.status))
  const total = byStatus.reduce((sum, row) => sum + row.count, 0)
  const weighted = byStatus.reduce((sum, row) => sum + CONNECTION_STATUS_META[row.status].progress * row.count, 0)
  return {
    total,
    approved: byStatus.find((row) => row.status === 'DOSAR_APROBAT')?.count || 0,
    completed: byStatus.find((row) => row.status === 'FINALIZAT')?.count || 0,
    active: byStatus.filter((row) => !['FINALIZAT', 'SUSPENDAT'].includes(row.status)).reduce((sum, row) => sum + row.count, 0),
    averageProgress: total ? Math.round(weighted / total) : 0,
    byStatus,
  }
}
