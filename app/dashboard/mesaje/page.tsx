import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureMessageStorage } from '@/lib/ensure-message-storage'
import { MessagesManager } from '@/components/messages/messages-manager'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const session=await auth(); const businessId=(session as any)?.businessId as string|undefined
  if(!businessId)redirect('/login')
  await ensureMessageStorage()
  const rows=await prisma.$queryRaw<any[]>`SELECT "id", "name", "email", "phone", "message", "status", "internalNote", "createdAt" FROM "CustomerMessage" WHERE "businessId"=${businessId} OR "businessId" IS NULL ORDER BY "createdAt" DESC`
  return <div className="mx-auto max-w-[1300px] p-4 lg:p-8"><MessagesManager initialMessages={rows.map(row=>({...row,createdAt:row.createdAt.toISOString()}))} canManage={(session as any)?.role !== 'STAFF'}/></div>
}