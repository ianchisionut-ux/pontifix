import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

export function normalizeWhatsAppPhone(phone: string) {
  let digits = phone.replace(/[^\d]/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = `40${digits.slice(1)}`
  else if (!digits.startsWith('40') && digits.length === 9) digits = `40${digits}`
  return digits
}

export function whatsappFallbackUrl(phone: string, text: string) {
  return `https://wa.me/${normalizeWhatsAppPhone(phone)}?text=${encodeURIComponent(text)}`
}

export async function sendProjectWhatsApp(channelId: string, to: string, text: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel || channel.type !== 'WHATSAPP') throw new Error('Canalul WhatsApp nu a fost găsit.')
  const accessToken = decrypt(channel.accessToken)
  const response = await fetch(`https://graph.facebook.com/v21.0/${channel.externalId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizeWhatsAppPhone(to), type: 'text', text: { preview_url: false, body: text } }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result?.error?.message || `Meta a respins mesajul (${response.status}).`)
}
