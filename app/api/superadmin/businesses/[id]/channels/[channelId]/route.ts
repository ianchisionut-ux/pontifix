import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; channelId: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  await prisma.channel.update({ where: { id: channelId }, data: { status: 'DISCONNECTED' } })

  return NextResponse.json({ success: true })
}
