import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function getOfferAccess() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const role = (session as any)?.role as string | undefined
  if (!businessId) return null
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } })
  if (role !== 'SUPER_ADMIN' && !business?.name.toLocaleUpperCase('ro-RO').includes('ELMONT')) return null
  return { session, businessId, role, canManage: role !== 'STAFF' }
}