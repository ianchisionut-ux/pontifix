import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation || conversation.businessId !== businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // ștergem și istoricul de mesaje al acestei conversații — dacă și dacă clientul
  // scrie din nou, se creează automat o conversație nouă, curată
  await prisma.chatMessage.deleteMany({
    where: { businessId, channel: conversation.channel, externalUserId: conversation.externalUserId },
  })
  await prisma.conversation.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
