import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { createBookEasyCalendar, syncFutureBookings } from '@/lib/google-calendar'
import { verifyCalendarState } from '@/lib/google-calendar-oauth'

export async function GET(req: NextRequest) {
  const back = (status: string) => NextResponse.redirect(`${process.env.APP_URL}/dashboard/medici?google=${status}`)
  try {
    const session = await auth()
    const state = verifyCalendarState(req.nextUrl.searchParams.get('state') ?? '')
    if (!(session as any)?.businessId || (session as any).businessId !== state.businessId) return back('unauthorized')
    const practitioner = await prisma.practitioner.findFirst({ where: { id: state.practitionerId, businessId: state.businessId }, include: { business: true } })
    if (!practitioner) return back('not_found')
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
      code: req.nextUrl.searchParams.get('code') ?? '', client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', redirect_uri: `${process.env.APP_URL}/api/google-calendar/callback`, grant_type: 'authorization_code',
    }) })
    const token = await response.json()
    if (!response.ok || !token.access_token) throw new Error(token.error_description ?? 'Google nu a returnat accesul.')
    const profile = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } }).then((r) => r.json())
    const existing = await prisma.googleCalendarConnection.findUnique({ where: { practitionerId: practitioner.id } })
    const calendar = existing ? { id: existing.calendarId, name: existing.calendarName } : await createBookEasyCalendar(token.access_token, practitioner.name, practitioner.business.timezone)
    await prisma.googleCalendarConnection.upsert({ where: { practitionerId: practitioner.id }, create: {
      businessId: state.businessId, practitionerId: practitioner.id, googleEmail: profile.email ?? null, calendarId: calendar.id, calendarName: calendar.name,
      accessToken: encrypt(token.access_token), refreshToken: token.refresh_token ? encrypt(token.refresh_token) : null, expiresAt: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000),
    }, update: {
      googleEmail: profile.email ?? null, accessToken: encrypt(token.access_token), ...(token.refresh_token ? { refreshToken: encrypt(token.refresh_token) } : {}), expiresAt: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000), syncEnabled: true, lastError: null,
    } })
    await syncFutureBookings(practitioner.id)
    return back('connected')
  } catch (error) {
    console.error('[google-calendar/callback]', error)
    return back('error')
  }
}
