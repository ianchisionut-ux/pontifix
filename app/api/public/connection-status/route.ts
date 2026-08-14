import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { CONNECTION_STATUS_META, isConnectionStatus } from '@/lib/connection-status'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const schema = z.object({ nib: z.string().trim().toUpperCase().regex(/^NIB-\d{4}-\d{4,}$/) })

export async function POST(request: NextRequest) {
  if (!rateLimit(`nib:${getClientIp(request)}`, 20, 15 * 60_000).allowed) {
    return NextResponse.json({ error: 'Prea multe verificări. Încearcă din nou mai târziu.' }, { status: 429 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Introdu un NIB valid, de forma NIB-2026-0001.' }, { status: 400 })
  await ensureConnectionStorage()
  const rows = await prisma.$queryRaw<Array<{ nib: string; status: string; updatedAt: Date }>>`
    SELECT "nib", "status", "updatedAt" FROM "ConnectionCase" WHERE UPPER("nib")=${parsed.data.nib} LIMIT 1
  `
  const item = rows[0]
  if (!item || !isConnectionStatus(item.status)) return NextResponse.json({ error: 'Nu am găsit un branșament cu acest NIB.' }, { status: 404 })
  const meta = CONNECTION_STATUS_META[item.status]
  return NextResponse.json({ nib: item.nib, status: item.status, label: meta.label, progress: meta.progress, color: meta.color, updatedAt: item.updatedAt.toISOString() })
}
