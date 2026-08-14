import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { CONNECTION_STATUSES } from '@/lib/connection-status'

const updateSchema = z.object({
  fields: connectionFieldsSchema.optional(),
  status: z.enum(CONNECTION_STATUSES).optional(),
}).refine((value) => value.fields || value.status, 'Nicio modificare.')

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate modifica branșamentele.' }, { status: 403 })
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await ensureConnectionStorage()
  const { id } = await params
  let changed = 0
  if (parsed.data.fields) changed = Number(await prisma.$executeRaw`UPDATE "ConnectionCase" SET "fields"=${JSON.stringify(parsed.data.fields)}::jsonb, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${access.businessId}`)
  if (parsed.data.status) changed = Number(await prisma.$executeRaw`UPDATE "ConnectionCase" SET "status"=${parsed.data.status}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${access.businessId}`)
  if (!changed) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate șterge branșamente.' }, { status: 403 })
  await ensureConnectionStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ atrPathname: string | null }>>`SELECT "atrPathname" FROM "ConnectionCase" WHERE "id"=${id} AND "businessId"=${access.businessId} LIMIT 1`
  if (!rows[0]) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  await prisma.$executeRaw`DELETE FROM "ConnectionCase" WHERE "id"=${id} AND "businessId"=${access.businessId}`
  if (rows[0].atrPathname) await del(rows[0].atrPathname).catch(() => undefined)
  return NextResponse.json({ success: true })
}