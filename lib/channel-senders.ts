import { prisma } from './prisma'
import { decrypt } from './crypto'

type Channel = 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'

// WhatsApp cere formatul internațional complet, fără 0 la început, fără "+", fără
// spații/liniuțe (ex: "40745895623", nu "0745895623" sau "+40 745 895 623"). Clienții
// scriu numărul cum vor la rezervare — normalizăm mereu chiar înainte de trimitere,
// presupunând România (40) dacă nu are deja alt prefix de țară
function normalizeWhatsAppPhone(phone: string): string {
  let digits = phone.replace(/[^\d]/g, '') // scoate tot ce nu e cifră (spații, -, +, paranteze)
  if (digits.startsWith('0')) {
    digits = '40' + digits.slice(1) // 0745... → 40745...
  } else if (!digits.startsWith('40') && digits.length === 9) {
    digits = '40' + digits // 745895623 (fără 0, fără prefix) → 40745895623
  }
  return digits
}

// fetch() nu aruncă eroare pentru răspunsuri 4xx/5xx — doar pentru eșec de rețea. Meta
// poate respinge silențios un mesaj (număr neverificat în modul de test, token expirat,
// format greșit etc.) și, fără verificare explicită, codul ar raporta "succes" oricum,
// deși mesajul n-a plecat niciodată cu adevărat
async function metaFetch(url: string, options: RequestInit): Promise<any> {
  const res = await fetch(url, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.error?.message ?? `Meta a respins cererea (status ${res.status})`
    throw new Error(message)
  }
  return data
}

export async function sendMessage({
  channel,
  channelId,
  to,
  text,
}: {
  channel: Channel
  channelId: string
  to: string
  text: string
}) {
  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channelRecord) throw new Error('Channel not found')
  const accessToken = decrypt(channelRecord.accessToken)

  if (channel === 'WHATSAPP') {
    await metaFetch(`https://graph.facebook.com/v21.0/${channelRecord.externalId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizeWhatsAppPhone(to), type: 'text', text: { body: text } }),
    })
    return
  }

  // Instagram și Facebook Messenger folosesc același Send API
  await metaFetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: to }, message: { text } }),
  })
}

// butoane verticale, stivuite — max 3, folosite pentru meniuri scurte (start, confirmare)
// unde clientul trebuie să vadă toate opțiunile deodată, nu într-un carousel cu swipe
export async function sendWhatsAppButtons({
  channelId,
  to,
  bodyText,
  options,
}: {
  channelId: string
  to: string
  bodyText: string
  options: { id: string; title: string; url?: string }[]
}) {
  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channelRecord) throw new Error('Channel not found')
  const accessToken = decrypt(channelRecord.accessToken)

  await metaFetch(`https://graph.facebook.com/v21.0/${channelRecord.externalId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizeWhatsAppPhone(to),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText.slice(0, 1024) },
        action: {
          buttons: options.slice(0, 3).map((o) => ({
            type: 'reply',
            reply: { id: o.id.slice(0, 256), title: o.title.slice(0, 20) },
          })),
        },
      },
    }),
  })
}

export async function sendMessengerButtons({
  channelId,
  to,
  bodyText,
  options,
}: {
  channelId: string
  to: string
  bodyText: string
  options: { id: string; title: string; url?: string }[]
}) {
  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channelRecord) throw new Error('Channel not found')
  const accessToken = decrypt(channelRecord.accessToken)

  await metaFetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: to },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: bodyText.slice(0, 640),
            // butoanele cu url deschid pagina direct în browser, la un singur tap —
            // Messenger permite amestecul de tipuri (postback + web_url) în același mesaj
            buttons: options.slice(0, 3).map((o) =>
              o.url
                ? { type: 'web_url', title: o.title.slice(0, 20), url: o.url }
                : { type: 'postback', title: o.title.slice(0, 20), payload: o.id }
            ),
          },
        },
      },
    }),
  })
}

export type ChoiceGroup = {
  label: string // ex: numele zilei — apare ca titlu de secțiune (WhatsApp) sau se include în titlul cardului (Messenger)
  options: { id: string; title: string; subtitle?: string }[] // id = valoarea reală trimisă înapoi la selectare (ex: ISO al orei)
}

// listă interactivă, tappable — clientul apasă direct, nu mai scrie un număr. WhatsApp
// limitează la 10 rânduri TOTAL (nu per secțiune), deci grupurile trebuie deja limitate
// înainte să ajungă aici
export async function sendWhatsAppList({
  channelId,
  to,
  headerText,
  bodyText,
  buttonText,
  groups,
}: {
  channelId: string
  to: string
  headerText: string
  bodyText: string
  buttonText: string
  groups: ChoiceGroup[]
}) {
  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channelRecord) throw new Error('Channel not found')
  const accessToken = decrypt(channelRecord.accessToken)

  const sections = groups.map((g) => ({
    title: g.label.slice(0, 24),
    rows: g.options.map((o) => ({
      id: o.id.slice(0, 200),
      title: o.title.slice(0, 24),
      ...(o.subtitle ? { description: o.subtitle.slice(0, 72) } : {}),
    })),
  }))

  await metaFetch(`https://graph.facebook.com/v21.0/${channelRecord.externalId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizeWhatsAppPhone(to),
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: headerText.slice(0, 60) },
        body: { text: bodyText.slice(0, 1024) },
        action: { button: buttonText.slice(0, 20), sections },
      },
    }),
  })
}

// carousel real, cu carduri orizontale — folosit pe Messenger/Instagram. Limită Meta:
// 10 carduri per mesaj. Fiecare card e o opțiune selectabilă printr-un buton
export async function sendMessengerCarousel({
  channelId,
  to,
  cards,
}: {
  channelId: string
  to: string
  cards: { id: string; title: string; subtitle?: string; buttonLabel: string }[]
}) {
  const channelRecord = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channelRecord) throw new Error('Channel not found')
  const accessToken = decrypt(channelRecord.accessToken)

  const elements = cards.slice(0, 10).map((c) => ({
    title: c.title.slice(0, 80),
    ...(c.subtitle ? { subtitle: c.subtitle.slice(0, 80) } : {}),
    buttons: [{ type: 'postback', title: c.buttonLabel.slice(0, 20), payload: c.id }],
  }))

  await metaFetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: to },
      message: { attachment: { type: 'template', payload: { template_type: 'generic', elements } } },
    }),
  })
}
