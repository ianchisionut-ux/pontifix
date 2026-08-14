import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { CONNECTION_FIELDS, defaultConnectionFields } from '@/lib/connection-fields'

export const runtime = 'nodejs'

function authorized(request: NextRequest) {
  const expected = process.env.LEGACY_MIGRATION_TOKEN || ''
  const received = request.headers.get('x-migration-token') || ''
  if (!expected || expected.length !== received.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const history = await request.json() as Array<{ id?: string; beneficiar?: string; data?: string; campuri?: Record<string, unknown> }>
  if (!Array.isArray(history) || history.length > 100) return NextResponse.json({ error: 'Istoric invalid.' }, { status: 400 })
  await ensureConnectionStorage()
  const users = await prisma.$queryRaw<Array<{ businessId: string | null }>>`
    SELECT "businessId" FROM "User" WHERE lower("email")='elmont_zalau@yahoo.com' LIMIT 1
  `
  const businessId = users[0]?.businessId
  if (!businessId) return NextResponse.json({ error: 'Compania Elmont nu a fost găsită.' }, { status: 404 })
  let inserted = 0
  for (const entry of history) {
    const fields = defaultConnectionFields()
    const legacy = entry.campuri || {}
    for (const field of CONNECTION_FIELDS) {
      const value = legacy[field]
      if (value !== undefined && value !== null) fields[field] = String(value).trim().slice(0, 4000)
    }
    if (!fields.Beneficiar) fields.Beneficiar = String(entry.beneficiar || '').slice(0, 300)
    const signature = `${entry.id || ''}|${entry.data || ''}|${fields.Beneficiar}|${fields.ATR}`
    const id = `legacy_${crypto.createHash('sha256').update(signature).digest('hex').slice(0, 28)}`
    const createdAt = entry.data && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(entry.data)
      ? new Date(entry.data.replace(' ', 'T') + ':00+03:00')
      : new Date()
    const fieldsJson = JSON.stringify(fields)
    const changed = await prisma.$executeRaw`
      INSERT INTO "ConnectionCase" ("id", "businessId", "fields", "createdByEmail", "createdAt", "updatedAt")
      VALUES (${id}, ${businessId}, CAST(${fieldsJson} AS JSONB), 'Migrare aplicație locală', ${createdAt}, ${createdAt})
      ON CONFLICT ("id") DO NOTHING
    `
    inserted += Number(changed)
  }
  const counts = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count" FROM "ConnectionCase" WHERE "businessId"=${businessId}
  `
  return NextResponse.json({ sourceEntries: history.length, inserted, portalTotal: Number(counts[0]?.count || 0) })
}
