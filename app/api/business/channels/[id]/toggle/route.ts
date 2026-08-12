import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const { enabledByOwner } = await req.json()

  // owner-ul poate opri/porni doar canale care aparțin business-ului lui — nu poate atinge conexiunea/cheile
  const channel = await prisma.channel.findUnique({ where: { id } })
  if (!channel || channel.businessId !== (session as any).businessId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  await prisma.channel.update({ where: { id }, data: { enabledByOwner: Boolean(enabledByOwner) } })

  return NextResponse.json({ success: true })
}
