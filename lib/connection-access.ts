import { auth } from '@/lib/auth'

export async function getConnectionAccess() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const role = (session as any)?.role as string | undefined
  if (!businessId) return null
  return { session, businessId, role, canManage: role === 'SUPER_ADMIN' }
}
