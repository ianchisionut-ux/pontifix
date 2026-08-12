import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const status = (await req.json()).status
  if (!['APPROVED', 'REJECTED'].includes(status)) return NextResponse.json({ error: 'Status invalid.' }, { status: 400 })
  const { id } = await params
  const found = await prisma.leaveRequest.findFirst({ where: { id, businessId } })
  if (!found) return NextResponse.json({ error: 'Cerere inexistentă.' }, { status: 404 })
  await prisma.leaveRequest.update({ where: { id }, data: { status } })
  return NextResponse.json({ success: true })
}
