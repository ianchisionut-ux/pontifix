import { NextRequest, NextResponse } from 'next/server'
import { EuPlatesc } from 'euplatesc'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { sendMessage } from '@/lib/channel-senders'

// Montată la /api/webhooks/euplatesc/:slug — fiecare business configurează în propriul cont
// EuPlatesc un "silent URL" către acest URL specific, deci știm direct din URL cărui
// business îi aparține notificarea.
//
// Spre deosebire de Netopia, EuPlatesc.checkResponse() nu are nevoie de corpul brut al
// cererii — recalculează hash-ul din câmpurile individuale primite.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({ where: { slug } })
  if (!business || !business.euplatescMerchantId || !business.euplatescSecretKey) {
    return new NextResponse(null, { status: 404 })
  }

  const formData = await req.formData()
  const b = Object.fromEntries(formData.entries()) as Record<string, string>

  // EuPlatesc trimite câmpurile în format snake_case — le mapăm la numele camelCase
  // așteptate de checkResponse()
  const fields = {
    amount: b.amount,
    currency: b.curr,
    invoiceId: b.invoice_id,
    epId: b.ep_id,
    merchantId: b.merch_id,
    action: b.action,
    message: b.message,
    approval: b.approval,
    timestamp: b.timestamp,
    nonce: b.nonce,
    fpHash: b.fp_hash,
  }

  if (!fields.invoiceId || !fields.fpHash) {
    console.error(`[EuPlatesc:${slug}] Notificare cu câmpuri lipsă — ignorată.`)
    return new NextResponse(null, { status: 400 })
  }

  const ep = new EuPlatesc({
    merchantId: decrypt(business.euplatescMerchantId),
    secretKey: decrypt(business.euplatescSecretKey),
    testMode: !business.euplatescIsLive,
  })

  let result: any
  try {
    result = ep.checkResponse(fields as any)
  } catch (err: any) {
    console.error(`[EuPlatesc:${slug}] Eroare la verificarea notificării:`, err.message)
    return new NextResponse(null, { status: 400 })
  }

  if (result.response === 'invalid') {
    console.error(`[EuPlatesc:${slug}] Notificare cu hash invalid — posibil falsă, ignorată.`)
    return new NextResponse(null, { status: 400 })
  }

  // procesăm ÎNAINTE de a răspunde — vezi motivul identic la webhook-ul Netopia
  try {
    await processEuplatescResult(result.response === 'complete', fields.invoiceId!, business.id)
  } catch (err: any) {
    console.error(`[EuPlatesc:${slug}] Eroare procesare notificare:`, err)
  }

  return new NextResponse(null, { status: 200 })
}

async function processEuplatescResult(isComplete: boolean, bookingId: string, businessId: string) {
  if (!isComplete) return // "failed" — ignorăm, rezervarea rămâne în așteptare

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, businessId },
    include: { customer: true, service: true, business: { include: { channels: true } } },
  })
  if (!booking) return
  if (booking.depositPaid) return // deja procesată (EuPlatesc poate retrimite aceeași notificare)

  await prisma.booking.update({
    where: { id: booking.id },
    data: { depositPaid: true, status: booking.status === 'PENDING' ? 'CONFIRMED' : booking.status },
  })

  const channel = booking.business.channels.find((c) => c.type === booking.channel && c.status === 'ACTIVE')
  if (!channel) return

  try {
    await sendMessage({
      channel: booking.channel as 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK',
      channelId: channel.id,
      to: booking.customer.phone ?? '',
      text: `Plata a fost confirmată! Avansul pentru ${booking.service.name} a fost înregistrat. Îți mulțumim!`,
    })
  } catch (err: any) {
    console.error(`[EuPlatesc] Rezervare confirmată, dar mesajul către client a eșuat:`, err.message)
  }
}
