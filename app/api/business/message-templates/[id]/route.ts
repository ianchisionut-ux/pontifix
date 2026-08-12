import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const template = await prisma.messageTemplate.findUnique({ where: { id } })
  if (!template || template.businessId !== businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await prisma.messageTemplate.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
