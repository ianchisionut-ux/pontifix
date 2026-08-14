import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate modifica branșamentele.' }, { status: 403 })
  const parsed = connectionFieldsSchema.safeParse((await request.json()).fields)
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await ensureConnectionStorage()
  const { id } = await params
  const fieldsJson = JSON.stringify(parsed.data)
  const changed = await prisma.$executeRaw`
    UPDATE "ConnectionCase" SET "fields"=CAST(${fieldsJson} AS JSONB), "updatedAt"=CURRENT_TIMESTAMP
    WHERE "id"=${id} AND "businessId"=${access.businessId}
  `
  if (!changed) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate șterge branșamente.' }, { status: 403 })
  await ensureConnectionStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ atrPathname: string | null }>>`
    SELECT "atrPathname" FROM "ConnectionCase" WHERE "id"=${id} AND "businessId"=${access.businessId} LIMIT 1
  `
  if (!rows[0]) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  await prisma.$executeRaw`DELETE FROM "ConnectionCase" WHERE "id"=${id} AND "businessId"=${access.businessId}`
  if (rows[0].atrPathname) await del(rows[0].atrPathname).catch(() => undefined)
  return NextResponse.json({ success: true })
}
