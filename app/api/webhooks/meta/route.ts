import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processIncomingMessage } from '@/lib/bot-engine'

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const signature = req.headers.get('x-hub-signature-256')
  const expected =
    'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET!).update(rawBody).digest('hex')

  if (signature !== expected) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)

  for (const entry of body.entry ?? []) {
    if (body.object === 'whatsapp_business_account') {
      await handleWhatsAppEntry(entry)
    } else if (body.object === 'instagram') {
      await handleMessengerEntry(entry, 'INSTAGRAM')
    } else if (body.object === 'page') {
      await handleMessengerEntry(entry, 'FACEBOOK')
    }
  }

  return NextResponse.json({ received: true })
}

async function handleWhatsAppEntry(entry: any) {
  const value = entry.changes?.[0]?.value
  const message = value?.messages?.[0]
  if (!message) return

  // Meta poate livra același eveniment de mai multe ori — dacă am mai procesat deja
  // acest ID de mesaj, ignorăm complet, ca botul să nu avanseze conversația de 2 ori
  if (message.id && !(await markMessageProcessed(message.id))) return

  const phoneNumberId = value.metadata.phone_number_id
  const channel = await prisma.channel.findUnique({
    where: { type_externalId: { type: 'WHATSAPP', externalId: phoneNumberId } },
  })
  if (!channel) return

  await processIncomingMessage({
    businessId: channel.businessId,
    channel: 'WHATSAPP',
    externalUserId: message.from,
    // dacă a apăsat pe o opțiune din listă, folosim ID-ul acelei opțiuni direct —
    // altfel, textul scris de mână
    text: message.interactive?.list_reply?.id ?? message.interactive?.button_reply?.id ?? message.text?.body ?? extractNonTextContent(message),
    channelId: channel.id,
  })
}

async function handleMessengerEntry(entry: any, type: 'INSTAGRAM' | 'FACEBOOK') {
  const messaging = entry.messaging?.[0]
  // apăsarea pe un buton de carousel vine ca "postback", nu ca "message" — trebuie
  // tratate separat, altfel butoanele din carousel sunt complet ignorate
  const effectiveText = messaging?.postback?.payload ?? messaging?.message?.quick_reply?.payload ?? messaging?.message?.text
  if (!messaging || (!messaging.message && !messaging.postback)) return

  const messageId = messaging.message?.mid ?? messaging.postback?.mid
  if (messageId && !(await markMessageProcessed(messageId))) return

  const pageId = entry.id
  const channel = await prisma.channel.findUnique({ where: { type_externalId: { type, externalId: pageId } } })
  if (!channel) return

  await processIncomingMessage({
    businessId: channel.businessId,
    channel: type,
    externalUserId: messaging.sender.id,
    text: effectiveText ?? '[atașament]',
    channelId: channel.id,
  })
}

// întoarce true dacă e prima oară când vedem acest ID de mesaj (deci trebuie procesat),
// și false dacă l-am mai procesat deja (deci sărim peste el). Bazat pe constrângerea
// unică din baza de date — sigur chiar și dacă mai multe cereri ajung simultan
async function markMessageProcessed(messageId: string): Promise<boolean> {
  try {
    await prisma.processedWebhookMessage.create({ data: { id: messageId } })
    return true
  } catch {
    // eroare de constrângere unică — ID-ul există deja, e un duplicat
    return false
  }
}

function extractNonTextContent(message: any) {
  if (message.type === 'audio') return '[mesaj audio]'
  if (message.type === 'image') return '[imagine]'
  return '[conținut nesuportat]'
}
