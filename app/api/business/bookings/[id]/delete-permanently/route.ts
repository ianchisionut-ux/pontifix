import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const businessId = (session as any).businessId

  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking || booking.businessId !== businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // ștergere definitivă, din bază — spre deosebire de "Anulează", care doar schimbă
  // statusul și păstrează rândul (util pentru istoric/statistici). Aici chiar dispare.
  await prisma.booking.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
