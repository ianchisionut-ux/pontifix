import { NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureConnectionStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ atrPathname: string | null; atrName: string | null }>>`
    SELECT "atrPathname", "atrName" FROM "ConnectionCase" WHERE "id"=${id} AND "businessId"=${access.businessId} LIMIT 1
  `
  const item = rows[0]
  if (!item?.atrPathname) return NextResponse.json({ error: 'ATR inexistent.' }, { status: 404 })
  const result = await get(item.atrPathname, { access: 'private' })
  if (!result?.stream) return NextResponse.json({ error: 'Fișier indisponibil.' }, { status: 404 })
  const filename = (item.atrName || 'ATR.pdf').replace(/["\r\n]/g, '')
  return new Response(result.stream, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` } })
}
