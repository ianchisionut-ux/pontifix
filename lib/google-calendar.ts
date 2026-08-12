import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3'

async function accessToken(connection: { id: string; accessToken: string; refreshToken: string | null; expiresAt: Date | null }) {
  if (!connection.expiresAt || connection.expiresAt.getTime() > Date.now() + 60_000) return decrypt(connection.accessToken)
  if (!connection.refreshToken) throw new Error('Contul Google trebuie reconectat.')
  const response = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: decrypt(connection.refreshToken), grant_type: 'refresh_token',
    }),
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) throw new Error(data.error_description ?? 'Reautorizarea Google a eșuat.')
  await prisma.googleCalendarConnection.update({ where: { id: connection.id }, data: {
    accessToken: encrypt(data.access_token), expiresAt: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000),
  } })
  return data.access_token as string
}

async function googleFetch(token: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers } })
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error?.message ?? `Google Calendar a răspuns cu ${response.status}.`)
  }
  return response
}

export async function createBookEasyCalendar(token: string, practitionerName: string, timezone: string) {
  const response = await googleFetch(token, `${API}/calendars`, {
    method: 'POST', body: JSON.stringify({ summary: `BookEasy – ${practitionerName}`, description: 'Programări sincronizate automat din BookEasy. Modifică programările în BookEasy.', timeZone: timezone }),
  })
  const calendar = await response.json()
  return { id: calendar.id as string, name: calendar.summary as string }
}

export async function syncBookingToGoogle(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: {
    customer: true, service: true, business: true,
    practitioner: { include: { googleCalendar: true } },
  } })
  const connection = booking?.practitioner?.googleCalendar
  if (!booking || !connection?.syncEnabled) return

  try {
    const token = await accessToken(connection)
    if (booking.status === 'CANCELLED') {
      if (booking.googleCalendarEventId) await googleFetch(token, `${API}/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(booking.googleCalendarEventId)}`, { method: 'DELETE' })
      await prisma.booking.update({ where: { id: booking.id }, data: { googleCalendarEventId: null, googleCalendarSyncedAt: new Date(), googleCalendarSyncError: null } })
      return
    }

    const details = connection.includeCustomerDetails
    const summary = details ? `${booking.customer.name ?? 'Client'} – ${booking.service.name}` : 'Programare BookEasy'
    const description = details
      ? `Client: ${booking.customer.name ?? 'Client'}\nTelefon: ${booking.customer.phone}\nServiciu: ${booking.service.name}\nStatus: ${booking.status}\n\nModifică programarea numai în BookEasy.`
      : 'Programare sincronizată din BookEasy. Modifică programarea numai în BookEasy.'
    const payload = { summary, description, start: { dateTime: booking.startAt.toISOString(), timeZone: booking.business.timezone }, end: { dateTime: booking.endAt.toISOString(), timeZone: booking.business.timezone }, extendedProperties: { private: { bookeasyBookingId: booking.id } } }
    let eventId = booking.googleCalendarEventId
    let response = eventId ? await googleFetch(token, `${API}/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'PUT', body: JSON.stringify(payload) }) : null
    if (!response || response.status === 404 || response.status === 410) {
      response = await googleFetch(token, `${API}/calendars/${encodeURIComponent(connection.calendarId)}/events`, { method: 'POST', body: JSON.stringify(payload) })
      eventId = (await response.json()).id
    }
    await Promise.all([
      prisma.booking.update({ where: { id: booking.id }, data: { googleCalendarEventId: eventId, googleCalendarSyncedAt: new Date(), googleCalendarSyncError: null } }),
      prisma.googleCalendarConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date(), lastError: null } }),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Eroare necunoscută Google Calendar.'
    await Promise.all([
      prisma.booking.update({ where: { id: booking.id }, data: { googleCalendarSyncError: message } }).catch(() => null),
      prisma.googleCalendarConnection.update({ where: { id: connection.id }, data: { lastError: message } }).catch(() => null),
    ])
    console.error(`[google-calendar] booking ${booking.id}:`, message)
  }
}

export async function syncFutureBookings(practitionerId: string) {
  const bookings = await prisma.booking.findMany({ where: { practitionerId, endAt: { gte: new Date() }, status: { not: 'CANCELLED' } }, select: { id: true }, orderBy: { startAt: 'asc' }, take: 500 })
  for (const booking of bookings) await syncBookingToGoogle(booking.id)
  return bookings.length
}
