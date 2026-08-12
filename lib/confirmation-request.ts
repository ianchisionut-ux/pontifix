import { sendWhatsAppButtons } from './channel-senders'

export async function sendConfirmationRequest(booking: any): Promise<{ success: boolean; error?: string }> {
  if (!booking.customer?.phone) return { success: false, error: 'Pacientul nu are un număr de telefon salvat.' }
  // reminder-ul merge mereu pe WhatsApp, indiferent pe ce canal a fost făcută
  // programarea inițial (bot, site sau introdusă manual de admin) — dacă avem telefon,
  // avem cum să trimitem
  const channel = booking.business.channels.find((c: any) => c.type === 'WHATSAPP' && c.status === 'ACTIVE' && c.enabledByOwner)
  if (!channel) return { success: false, error: 'Canalul WhatsApp nu e conectat sau activ pentru această afacere.' }

  const dateTime = booking.startAt.toLocaleString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Bucharest',
  })

  const bodyText = [
    '*Confirmă programarea*',
    '',
    `Serviciu: ${booking.service.name}`,
    `Data: ${dateTime}`,
    `Locație: ${booking.business.name}`,
  ].join('\n')

  const options = [
    { id: `REMINDER_CONFIRM_${booking.id}`, title: 'Confirmă programarea' },
    { id: `REMINDER_RESCHEDULE_${booking.id}`, title: 'Programare în altă zi' },
    { id: `REMINDER_CANCEL_${booking.id}`, title: 'Anulează programarea' },
  ]

  try {
    await sendWhatsAppButtons({ channelId: channel.id, to: booking.customer.phone, bodyText, options })
    return { success: true }
  } catch (err: any) {
    // aici ajunge acum mesajul REAL de la Meta (ex: număr neverificat, token expirat) —
    // nu mai ascundem cauza sub un mesaj generic
    return { success: false, error: err?.message ?? 'Eroare necunoscută la trimitere.' }
  }
}
