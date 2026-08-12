import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendMessage } from '@/lib/channel-senders'

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

  const whatsappChannel = booking.business.channels.find((c) => c.type === 'WHATSAPP' && c.status === 'ACTIVE' && c.enabledByOwner)
  if (!whatsappChannel) {
    return NextResponse.json({ error: 'WhatsApp nu e conectat sau activ pentru această afacere.' }, { status: 400 })
  }

  const dateTime = booking.startAt.toLocaleString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Bucharest',
  })

  const text = `Reminder: ai o programare la ${booking.business.name} pentru ${booking.service.name}, pe ${dateTime}. Te așteptăm!`

  try {
    await sendMessage({ channel: 'WHATSAPP', channelId: whatsappChannel.id, to: booking.customer.phone, text })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: `Trimiterea a eșuat: ${err?.message ?? 'eroare necunoscută'}` }, { status: 500 })
  }
}
