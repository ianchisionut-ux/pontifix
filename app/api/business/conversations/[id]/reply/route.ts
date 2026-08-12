import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendMessage } from '@/lib/channel-senders'
import { z } from 'zod'

const schema = z.object({ text: z.string().min(1).max(2000), operatorName: z.string().max(60).optional() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation || conversation.businessId !== businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Scrie un mesaj.' }, { status: 400 })

  const channelRecord = await prisma.channel.findFirst({
    where: { businessId, type: conversation.channel, status: 'ACTIVE', enabledByOwner: true },
  })
  if (!channelRecord) return NextResponse.json({ error: 'Canalul nu e conectat sau activ.' }, { status: 400 })

  const finalText = parsed.data.operatorName?.trim() ? `*${parsed.data.operatorName.trim()}:* ${parsed.data.text}` : parsed.data.text

  try {
    await sendMessage({ channel: conversation.channel as any, channelId: channelRecord.id, to: conversation.externalUserId, text: finalText })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Trimiterea a eșuat.' }, { status: 500 })
  }

  await prisma.chatMessage.create({
    data: { businessId, channel: conversation.channel, externalUserId: conversation.externalUserId, direction: 'OUT', text: finalText },
  })

  // răspunsul manual al operatorului rezolvă implicit cererea — dacă vrea, poate
  // redeschide conversația botului scriind din nou "programare"
  await prisma.conversation.update({ where: { id }, data: { needsOperator: false } })

  return NextResponse.json({ success: true })
}
