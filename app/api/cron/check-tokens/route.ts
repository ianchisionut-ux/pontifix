import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendAlertEmail } from '@/lib/email'
import { decrypt, encrypt } from '@/lib/crypto'

const WARNING_WINDOW_DAYS = 5

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const warningThreshold = new Date(now.getTime() + WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const channels = await prisma.channel.findMany({
    where: { status: { in: ['ACTIVE', 'EXPIRING_SOON'] }, expiresAt: { not: null, lte: warningThreshold } },
    include: { business: { include: { users: true } } },
  })

  const results = { expired: 0, expiringSoon: 0, autoRefreshed: 0 }

  for (const channel of channels) {
    if (channel.type === 'GOOGLE_BUSINESS' && channel.refreshToken) {
      const refreshed = await tryRefreshGoogleToken(channel.id, channel.refreshToken)
      if (refreshed) {
        results.autoRefreshed++
        continue
      }
    }

    const isExpired = channel.expiresAt! <= now
    const newStatus = isExpired ? 'EXPIRED' : 'EXPIRING_SOON'

    if (channel.status !== newStatus) {
      await prisma.channel.update({ where: { id: channel.id }, data: { status: newStatus } })

      const owner = channel.business.users.find((u) => u.role === 'OWNER')
      const daysLeft = Math.ceil((channel.expiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

      if (owner) {
        await sendAlertEmail({
          to: owner.email,
          subject: isExpired ? `Canalul ${channel.type} nu mai funcționează` : `Canalul ${channel.type} expiră în ${daysLeft} zile`,
          businessName: channel.business.name,
          channelType: channel.type,
          isExpired,
          daysLeft,
          reconnectUrl: `${process.env.APP_URL}/dashboard/canale`,
        })
      }

      isExpired ? results.expired++ : results.expiringSoon++
    }
  }

  return NextResponse.json({ checked: channels.length, ...results })
}

async function tryRefreshGoogleToken(channelId: string, refreshTokenEncrypted: string) {
  const refreshToken = decrypt(refreshTokenEncrypted)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) return false

  const data = await res.json()
  await prisma.channel.update({
    where: { id: channelId },
    data: {
      accessToken: encrypt(data.access_token),
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      status: 'ACTIVE',
    },
  })

  return true
}
