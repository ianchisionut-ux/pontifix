import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDeerBorderouStorage, saveDeerBorderou } from '@/lib/deer-borderou'
import { DEER_DOCUMENT_KINDS } from '@/lib/deer-borderou-shared'

export async function POST(request: Request) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate încărca documente DEER.' }, { status: 403 })
  const form = await request.formData()
  const parsed = z.string().uuid().safeParse(form.get('connectionId'))
  const kind = z.enum(DEER_DOCUMENT_KINDS).safeParse(form.get('documentKind') || 'BORDEROU')
  const file = form.get('file')
  if (!parsed.success || !kind.success || !(file instanceof File) || !/\.pdf$/i.test(file.name) || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Alege un PDF de maximum 4 MB.' }, { status: 400 })
  const content = Buffer.from(await file.arrayBuffer())
  if (content.subarray(0, 5).toString() !== '%PDF-') return NextResponse.json({ error: 'Fișierul nu este un PDF valid.' }, { status: 400 })
  const connectionId = parsed.data
  const cases = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ConnectionCase" WHERE "businessId"=${businessId} AND "id"=${connectionId} LIMIT 1`
  if (!cases.length) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  const id = await saveDeerBorderou({ businessId, connectionId, documentKind: kind.data, documentPathname: `db:${connectionId}:${Date.now()}`, documentData: content, documentName: file.name, source: 'UPLOAD' })
  return NextResponse.json({ id })
}

export async function PATCH(request: Request) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate asocia borderouri.' }, { status: 403 })
  const parsed = z.object({ id: z.string().uuid(), connectionId: z.string().uuid() }).safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await ensureDeerBorderouStorage()
  const { id, connectionId } = parsed.data
  const caseRows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ConnectionCase" WHERE "businessId"=${businessId} AND "id"=${connectionId} LIMIT 1`
  if (!caseRows.length) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  const updated = await prisma.$executeRaw`
    UPDATE "DeerBorderou" SET "connectionId"=${connectionId} WHERE "id"=${id} AND "businessId"=${businessId} AND "connectionId" IS NULL
  `
  if (!updated) return NextResponse.json({ error: 'Borderou inexistent.' }, { status: 404 })
  return NextResponse.json({ success: true })
}
