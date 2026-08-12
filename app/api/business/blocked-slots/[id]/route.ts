import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId

  const slot = await prisma.blockedSlot.findUnique({ where: { id } })
  if (!slot || slot.businessId !== businessId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  await prisma.blockedSlot.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
