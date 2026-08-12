import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendConfirmationRequest } from '@/lib/confirmation-request'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: true, service: true, business: { include: { channels: true } } },
  })

  if (!booking || booking.businessId !== businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!booking.customer.phone) return NextResponse.json({ error: 'Pacientul nu are un număr de telefon salvat.' }, { status: 400 })

  const result = await sendConfirmationRequest(booking)
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Nu am putut trimite mesajul.' }, { status: 400 })
  }

  await prisma.booking.update({ where: { id }, data: { confirmationRequestSent: true } })

  return NextResponse.json({ success: true })
}
