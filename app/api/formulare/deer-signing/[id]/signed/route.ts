import { NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDeerSigningStorage } from '@/lib/deer-signing'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureDeerSigningStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ signedPathname: string | null; nib: string }>>`
    SELECT "signedPathname", "nib" FROM "DeerSigningRequest" WHERE "id"=${id} AND "businessId"=${businessId} AND "completedAt" IS NOT NULL LIMIT 1`
  if (!rows[0]?.signedPathname) return NextResponse.json({ error: 'Documentele semnate nu sunt disponibile.' }, { status: 404 })
  const result = await get(rows[0].signedPathname, { access: 'private' })
  if (!result?.stream) return NextResponse.json({ error: 'PDF indisponibil.' }, { status: 404 })
  return new Response(result.stream, { headers: { 'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="DEER-${rows[0].nib.replace(/[^A-Za-z0-9-]/g, '')}-semnat.pdf"`,
    'Cache-Control': 'private, no-store' } })
}
