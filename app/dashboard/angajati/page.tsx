import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { EmployeeManager } from '@/components/attendance/employee-manager'
export const dynamic = 'force-dynamic'
export default async function EmployeesPage() { const session = await auth(); const businessId = (session as any)?.businessId; if (!businessId) redirect('/login'); const employees = await prisma.attendanceEmployee.findMany({ where: { businessId }, orderBy: [{ active: 'desc' }, { lastName: 'asc' }] }); return <div className="p-4 lg:p-8 max-w-6xl mx-auto"><EmployeeManager employees={employees}/></div> }
