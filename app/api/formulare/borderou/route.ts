import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDeerBorderouStorage, saveDeerBorderou } from '@/lib/deer-borderou'
import { isBorderouTemplate } from '@/lib/deer-borderou-shared'

const uploadSchema = z.object({
  connectionId: z.string().uuid(),
  documentPathname: z.string().min(10).max(1000).refine((value) => value.startsWith('formulare/deer/borderou/')),
  documentName: z.string().min(1).max(255).refine((value) => /\.pdf$/i.test(value)),
})
const templateSchema = z.object({ connectionId: z.string().uuid(), templateId: z.string().uuid() })

export async function POST(request: Request) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate încărca borderouri.' }, { status: 403 })
  const input = await request.json()
  const templateInput = templateSchema.safeParse(input)
  const uploadInput = uploadSchema.safeParse(input)
  if (!templateInput.success && !uploadInput.success) return NextResponse.json({ error: 'Datele borderoului sunt invalide.' }, { status: 400 })
  const connectionId = templateInput.success ? templateInput.data.connectionId : uploadInput.data!.connectionId
  const cases = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ConnectionCase" WHERE "businessId"=${businessId} AND "id"=${connectionId} LIMIT 1`
  if (!cases.length) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  let documentPathname: string
  let documentName: string
  if (templateInput.success) {
    const templates = await prisma.$queryRaw<Array<{ title: string; documentPathname: string; documentName: string }>>`
      SELECT "title", "documentPathname", "documentName" FROM "FormTemplate"
      WHERE "id"=${templateInput.data.templateId} AND "businessId"=${businessId} AND "category"='DEER' LIMIT 1
    `
    if (!templates.length || !isBorderouTemplate(templates[0].title)) return NextResponse.json({ error: 'Șablon Borderou inexistent.' }, { status: 404 })
    documentPathname = templates[0].documentPathname
    documentName = templates[0].documentName
  } else {
    documentPathname = uploadInput.data!.documentPathname
    documentName = uploadInput.data!.documentName
  }
  const id = await saveDeerBorderou({ businessId, connectionId, documentPathname, documentName, source: 'UPLOAD' })
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
