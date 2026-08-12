import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation || conversation.businessId !== businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const messages = await prisma.chatMessage.findMany({
    where: {
      businessId,
      channel: conversation.channel,
      externalUserId: conversation.externalUserId,
      ...(conversation.operatorRequestedAt ? { createdAt: { gte: conversation.operatorRequestedAt } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })

  return NextResponse.json({
    messages: messages.map((m) => ({ id: m.id, direction: m.direction, text: m.text, createdAt: m.createdAt.toISOString() })),
  })
}
