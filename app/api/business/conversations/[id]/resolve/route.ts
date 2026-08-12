import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation || conversation.businessId !== businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // marcăm rezolvat ȘI resetăm botul la starea inițială — dacă clientul mai scrie,
  // primește din nou meniul de start, nu rămâne "blocat" în tăcere
  await prisma.conversation.update({
    where: { id },
    data: { needsOperator: false, operatorRequestedAt: null, state: { step: 'IDLE' } },
  })

  return NextResponse.json({ success: true })
}
