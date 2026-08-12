import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [needsOperatorCount, unseenConfirmationsCount] = await Promise.all([
    prisma.conversation.count({ where: { businessId, needsOperator: true } }),
    prisma.booking.count({ where: { businessId, confirmationSeenByAdmin: false } }),
  ])

  return NextResponse.json({ needsOperatorCount, unseenConfirmationsCount })
}
