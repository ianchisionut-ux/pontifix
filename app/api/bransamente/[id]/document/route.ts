import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema } from '@/lib/connection-fields'
import { connectionDocumentName, generateConnectionDocx } from '@/lib/connection-docx'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const type = request.nextUrl.searchParams.get('type') === 'a3' ? 'a3' : 'contract'
  await ensureConnectionStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ fields: unknown }>>`
    SELECT "fields" FROM "ConnectionCase" WHERE "id"=${id} AND "businessId"=${access.businessId} LIMIT 1
  `
  if (!rows[0]) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  const parsed = connectionFieldsSchema.safeParse(rows[0].fields)
  if (!parsed.success) return NextResponse.json({ error: 'Datele documentului sunt invalide.' }, { status: 500 })
  const buffer = await generateConnectionDocx(parsed.data, type)
  const filename = connectionDocumentName(parsed.data, type)
  return new Response(new Uint8Array(buffer), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  } })
}
