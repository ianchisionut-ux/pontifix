import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDeerBorderouStorage, saveDeerBorderou } from '@/lib/deer-borderou'
import { DEER_DOCUMENT_KINDS } from '@/lib/deer-borderou-shared'

const associationFields = z.object({
  connectionId: z.string().uuid().optional(),
  projectId: z.string().trim().min(1).max(80).optional(),
})
const associationSchema = associationFields.refine(({ connectionId, projectId }) => Boolean(connectionId) !== Boolean(projectId))
const patchSchema = associationFields.extend({
  id: z.string().uuid(),
  reassign: z.boolean().optional(),
}).refine(({ connectionId, projectId }) => Boolean(connectionId) !== Boolean(projectId))

export async function POST(request: Request) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate încărca documente DEER.' }, { status: 403 })
  const form = await request.formData()
  const parsed = associationSchema.safeParse({
    connectionId: form.get('connectionId') || undefined,
    projectId: form.get('projectId') || undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: 'Alege un branșament sau un proiect.' }, { status: 400 })
  const kind = z.enum(DEER_DOCUMENT_KINDS).safeParse(form.get('documentKind') || 'BORDEROU')
  const file = form.get('file')
  if (!kind.success || !(file instanceof File) || !/\.pdf$/i.test(file.name) || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Alege un PDF de maximum 4 MB.' }, { status: 400 })
  const content = Buffer.from(await file.arrayBuffer())
  if (content.subarray(0, 5).toString() !== '%PDF-') return NextResponse.json({ error: 'Fișierul nu este un PDF valid.' }, { status: 400 })
  const { connectionId, projectId } = parsed.data
  if (connectionId) {
    const cases = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ConnectionCase" WHERE "businessId"=${businessId} AND "id"=${connectionId} LIMIT 1`
    if (!cases.length) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  } else if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, businessId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Proiect inexistent.' }, { status: 404 })
  }
  const id = await saveDeerBorderou({ businessId, connectionId: connectionId || null, projectId: projectId || null, documentKind: kind.data, documentPathname: `db:${connectionId || projectId}:${Date.now()}`, documentData: content, documentName: file.name, source: 'UPLOAD' })
  return NextResponse.json({ id })
}

export async function PATCH(request: Request) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate asocia borderouri.' }, { status: 403 })
  const parsed = patchSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await ensureDeerBorderouStorage()
  const { id, connectionId, projectId, reassign } = parsed.data
  if (connectionId) {
    const caseRows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "ConnectionCase" WHERE "businessId"=${businessId} AND "id"=${connectionId} LIMIT 1`
    if (!caseRows.length) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  } else if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, businessId }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Proiect inexistent.' }, { status: 404 })
  }
  const updated = await prisma.$executeRaw`
    UPDATE "DeerBorderou" SET "connectionId"=${connectionId || null}, "projectId"=${projectId || null}
    WHERE "id"=${id} AND "businessId"=${businessId}
      AND (${reassign === true} OR ("connectionId" IS NULL AND "projectId" IS NULL))
  `
  if (!updated) {
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "DeerBorderou" WHERE "id"=${id} AND "businessId"=${businessId} LIMIT 1`
    return NextResponse.json({ error: existing.length ? 'Documentul este deja asociat. Folosește mutarea explicită.' : 'Document DEER inexistent.' }, { status: existing.length ? 409 : 404 })
  }
  return NextResponse.json({ success: true })
}
