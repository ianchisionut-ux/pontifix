import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerRaw } = await params
  if (providerRaw !== 'google' && providerRaw !== 'meta') {
    return NextResponse.json({ error: 'invalid provider' }, { status: 400 })
  }
  const provider = providerRaw as 'google' | 'meta'
  const code = req.nextUrl.searchParams.get('code')
  const stateRaw = req.nextUrl.searchParams.get('state')
  if (!code || !stateRaw) {
    return NextResponse.redirect(`${process.env.APP_URL}/dashboard/canale?error=missing_code`)
  }

  const { businessId, redirectTo } = JSON.parse(Buffer.from(stateRaw, 'base64url').toString())
  const redirectUri = `${process.env.APP_URL}/api/oauth/${provider}/callback`

  const tokenRes = await fetch(
    provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://graph.facebook.com/v21.0/oauth/access_token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: provider === 'google' ? process.env.GOOGLE_CLIENT_ID! : process.env.META_APP_ID!,
        client_secret: provider === 'google' ? process.env.GOOGLE_CLIENT_SECRET! : process.env.META_APP_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    }
  )
  const tokenData = await tokenRes.json()

  if (provider === 'meta') {
    const longLived = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`
    ).then((r) => r.json())

    const pages = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${longLived.access_token}`).then((r) =>
      r.json()
    )

    for (const page of pages.data ?? []) {
      await prisma.channel.upsert({
        where: { type_externalId: { type: 'FACEBOOK', externalId: page.id } },
        create: {
          businessId,
          type: 'FACEBOOK',
          externalId: page.id,
          accessToken: encrypt(page.access_token),
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
        update: { accessToken: encrypt(page.access_token), status: 'ACTIVE' },
      })
    }
  }

  if (provider === 'google') {
    const accounts = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }).then((r) => r.json())

    const accountName = accounts.accounts?.[0]?.name // ex: "accounts/123456"

    // recenziile se cer pe LOCAȚIE, nu pe cont — trebuie numele complet al resursei
    // (ex: "accounts/123456/locations/789") ca să putem sincroniza ulterior recenziile
    let locationName = accountName ?? businessId
    if (accountName) {
      const locations = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      ).then((r) => r.json())
      locationName = locations.locations?.[0]?.name ?? locationName // ex: "accounts/123456/locations/789"
    }

    await prisma.channel.upsert({
      where: { type_externalId: { type: 'GOOGLE_BUSINESS', externalId: locationName } },
      create: {
        businessId,
        type: 'GOOGLE_BUSINESS',
        externalId: locationName,
        accessToken: encrypt(tokenData.access_token),
        refreshToken: encrypt(tokenData.refresh_token),
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
      update: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: encrypt(tokenData.refresh_token),
        status: 'ACTIVE',
      },
    })
  }

  return NextResponse.redirect(`${process.env.APP_URL}${redirectTo ?? '/dashboard/canale'}?connected=${provider}`)
}
