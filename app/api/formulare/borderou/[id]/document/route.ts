import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDeerBorderouStorage } from '@/lib/deer-borderou'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureDeerBorderouStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ documentPathname: string; documentName: string }>>`
    SELECT "documentPathname", "documentName" FROM "DeerBorderou" WHERE "id"=${id} AND "businessId"=${businessId} LIMIT 1
  `
  if (!rows.length) return NextResponse.json({ error: 'Borderou inexistent.' }, { status: 404 })
  const blob = await get(rows[0].documentPathname, { access: 'private' })
  if (!blob?.stream) return NextResponse.json({ error: 'PDF indisponibil.' }, { status: 404 })
  const filename = rows[0].documentName.replace(/["\r\n]/g, '')
  const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline'
  return new Response(blob.stream, { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': `${disposition}; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
  } })
}
