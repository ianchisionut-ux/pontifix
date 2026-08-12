import { NextRequest, NextResponse } from 'next/server'
import { Ipn } from 'netopia-payment2'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

// Codurile de status Netopia care înseamnă "banii au ajuns, confirmă rezervarea"
// (vezi node_modules/netopia-payment2 — constants.js pentru lista completă)
const STATUS_PAID = 3
const STATUS_CONFIRMED = 5

// Montată la /api/webhooks/netopia/:slug — fiecare business configurează în propriul cont
// Netopia un notifyUrl către acest URL specific, deci știm direct din URL cărui business
// îi aparține notificarea.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({ where: { slug } })
  if (!business || !business.netopiaPublicKey || !business.netopiaPosSignature) {
    return new NextResponse(null, { status: 404 })
  }

  // IMPORTANT: verificarea semnăturii Netopia se face pe baza corpului BRUT al cererii
  // (hash-ul trebuie calculat exact pe bytes-ii primiți, la fel ca la Stripe)
  const rawBody = await req.text()

  // Notă: documentația publică Netopia nu specifică explicit numele exact al header-ului
  // cu token-ul JWT de verificare — "verification-token" e cea mai probabilă variantă
  // (așa îl numește SDK-ul însuși ca parametru), dar merită confirmat cu o notificare
  // reală de test din contul Netopia, înainte de a merge live.
  const verificationToken =
    req.headers.get('verification-token') ?? req.headers.get('verificationtoken') ?? req.headers.get('x-verification-token')

  if (!verificationToken) {
    console.error(`[Netopia:${slug}] Notificare fără header de verificare — ignorată.`)
    return new NextResponse(null, { status: 400 })
  }

  const ipn = new Ipn({
    posSignature: decrypt(business.netopiaPosSignature),
    posSignatureSet: [decrypt(business.netopiaPosSignature)],
    publicKeyStr: decrypt(business.netopiaPublicKey),
    hashMethod: null,
    alg: null,
  })

  let result: any
  try {
    result = await ipn.verify(verificationToken, rawBody)
  } catch (err: any) {
    console.error(`[Netopia:${slug}] Eroare la verificarea notificării:`, err.message)
    return new NextResponse(null, { status: 400 })
  }

  if (result.errorType !== 0) {
    console.error(`[Netopia:${slug}] Notificare invalidă:`, result.errorMessage)
    return new NextResponse(null, { status: 400 })
  }

  // procesăm ÎNAINTE de a răspunde — dacă am răspunde imediat și am procesa în fundal,
  // pe Vercel serverless procesarea (marcarea plății + confirmarea rezervării) ar putea
  // fi întreruptă înainte să se termine, lăsând o plată reușită neconfirmată în sistem
  try {
    await processNetopiaResult(rawBody, result.status, business.id)
  } catch (err: any) {
    console.error(`[Netopia:${slug}] Eroare procesare notificare:`, err)
  }

  return new NextResponse(null, { status: 200 })
}

async function processNetopiaResult(rawBody: string, status: number, businessId: string) {
  if (status !== STATUS_PAID && status !== STATUS_CONFIRMED) return

  let orderID: string | undefined
  try {
    const parsed = JSON.parse(rawBody)
    orderID = parsed?.payment?.orderID ?? parsed?.order?.orderID
  } catch {
    return
  }
  if (!orderID) return

  const booking = await prisma.booking.findFirst({
    where: { id: orderID, businessId },
    include: { customer: true, service: true, business: { include: { channels: true } } },
  })
  if (!booking) return
  if (booking.depositPaid) return // deja procesată (Netopia poate retrimite notificarea)

  await prisma.booking.update({
    where: { id: booking.id },
    data: { depositPaid: true, status: booking.status === 'PENDING' ? 'CONFIRMED' : booking.status },
  })

  const channel = booking.business.channels.find((c) => c.type === booking.channel && c.status === 'ACTIVE')
  if (!channel) return

  try {
    const { sendMessage } = await import('@/lib/channel-senders')
    await sendMessage({
      channel: booking.channel as 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK',
      channelId: channel.id,
      to: booking.customer.phone ?? '',
      text: `Plata a fost confirmată! Avansul pentru ${booking.service.name} a fost înregistrat. Îți mulțumim!`,
    })
  } catch (err: any) {
    console.error(`[Netopia] Rezervare confirmată, dar mesajul către client a eșuat:`, err.message)
  }
}
