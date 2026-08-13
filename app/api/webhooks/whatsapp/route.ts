import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function validSignature(body: string, signature: string | null) {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) return true
  if (!signature?.startsWith('sha256=')) return false

  const received = signature.slice(7)
  const expected = crypto.createHmac('sha256', appSecret).update(body).digest('hex')
  if (received.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return NextResponse.json({ error: 'Verificarea webhookului a eșuat.' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  if (!validSignature(body, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Semnătură Meta invalidă.' }, { status: 401 })
  }

  try {
    const payload = JSON.parse(body)
    if (payload?.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Eveniment incompatibil.' }, { status: 400 })
    }

    // Pontifix trimite momentan actualizările manual. Evenimentele sunt confirmate
    // imediat, iar procesarea mesajelor și statusurilor poate fi adăugată ulterior.
    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Conținut JSON invalid.' }, { status: 400 })
  }
}
