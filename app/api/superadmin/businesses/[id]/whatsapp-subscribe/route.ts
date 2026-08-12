import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id: businessId } = await params
  const channel = await prisma.channel.findFirst({ where: { businessId, type: 'WHATSAPP' } })

  if (!channel || !channel.wabaId) {
    return NextResponse.json(
      { error: 'Salvează întâi Access Token-ul și WABA ID-ul canalului WhatsApp, apoi apasă din nou.' },
      { status: 400 }
    )
  }

  const accessToken = decrypt(channel.accessToken)

  const res = await fetch(`https://graph.facebook.com/v21.0/${channel.wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: data.error?.message ?? 'Meta a respins cererea.' }, { status: 400 })
  }

  return NextResponse.json({ success: true, data })
}
