import { get, head } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureTenderStorage, listTenders } from '@/lib/tenders'

type TenderPdf = { instructionPdfPathname: string | null; instructionPdfName: string | null }

async function access(id: string) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return { error: NextResponse.json({ error: 'Neautorizat.' }, { status: 401 }) }
  if (!z.string().uuid().safeParse(id).success) return { error: NextResponse.json({ error: 'Licitație invalidă.' }, { status: 400 }) }
  await ensureTenderStorage()
  const [tender] = await prisma.$queryRaw<TenderPdf[]>`SELECT "instructionPdfPathname", "instructionPdfName" FROM "Tender" WHERE "id"=${id} AND "businessId"=${businessId}`
  if (!tender) return { error: NextResponse.json({ error: 'Licitația nu a fost găsită.' }, { status: 404 }) }
  return { session, businessId, tender }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await access(id)
  if (result.error) return result.error
  if (!['OWNER', 'SUPER_ADMIN'].includes((result.session as any)?.role)) return NextResponse.json({ error: 'Nu ai permisiunea de încărcare.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const parsed = z.object({ pathname: z.string().max(500), name: z.string().trim().min(1).max(255) }).safeParse(body)
  if (!parsed.success || !parsed.data.pathname.startsWith(`tenders/${id}/instructions/`) || !parsed.data.pathname.endsWith('/instructions.pdf') || !/\.pdf$/i.test(parsed.data.name)) return NextResponse.json({ error: 'Fișier PDF invalid.' }, { status: 400 })
  const uploaded = await head(parsed.data.pathname).catch(() => null)
  if (!uploaded || uploaded.contentType !== 'application/pdf' || uploaded.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'PDF-ul încărcat nu este valid sau nu a fost găsit.' }, { status: 400 })
  await prisma.$executeRaw`UPDATE "Tender" SET "instructionPdfPathname"=${parsed.data.pathname}, "instructionPdfName"=${parsed.data.name}, "updatedAt"=NOW() WHERE "id"=${id} AND "businessId"=${result.businessId!}`
  return NextResponse.json(await listTenders(result.businessId!))
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await access(id)
  if (result.error) return result.error
  const { instructionPdfPathname: pathname, instructionPdfName: name } = result.tender!
  if (!pathname) return NextResponse.json({ error: 'Fișa de instrucțiuni nu a fost încărcată.' }, { status: 404 })
  const blob = await get(pathname, { access: 'private' })
  if (!blob?.stream) return NextResponse.json({ error: 'PDF-ul nu este disponibil.' }, { status: 404 })
  const safeName = (name || 'instructiuni.pdf').replace(/["\r\n]/g, '')
  const headers = new Headers({ 'Content-Type': 'application/pdf', 'Content-Disposition': `${req.nextUrl.searchParams.has('download') ? 'attachment' : 'inline'}; filename="${safeName}"`, 'Cache-Control': 'private, no-store' })
  return new Response(blob.stream, { headers })
}
