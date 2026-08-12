import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { LeaveManager } from '@/components/attendance/leave-manager'
export const dynamic = 'force-dynamic'
export default async function LeavesPage() { const session = await auth(); const businessId = (session as any)?.businessId; if (!businessId) redirect('/login'); const [employees, raw] = await Promise.all([prisma.attendanceEmployee.findMany({ where: { businessId, active: true }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: 'asc' } }), prisma.leaveRequest.findMany({ where: { businessId }, include: { employee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } })]); const requests = raw.map(r => ({ ...r, startDate: r.startDate.toISOString(), endDate: r.endDate.toISOString(), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })); return <div className="p-4 lg:p-8 max-w-6xl mx-auto"><LeaveManager employees={employees} requests={requests}/></div> }
