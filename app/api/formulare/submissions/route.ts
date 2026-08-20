import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureFormStorage } from '@/lib/ensure-form-storage'

const field = z.object({
  id: z.string().min(1).max(100), label: z.string().max(180), page: z.number().int().min(1).max(50),
  x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(.01).max(1),
  height: z.number().min(.01).max(1), fontSize: z.number().min(6).max(40), multiline: z.boolean().optional(),
  binding: z.string().max(150).optional(), defaultValue: z.string().max(4000).optional(),
})
const schema = z.object({
  id: z.string().uuid().optional(), formTemplateId: z.string().min(1).max(300),
  title: z.string().trim().min(2).max(180), sourceType: z.string().max(30).nullable().optional(),
  sourceId: z.string().max(200).nullable().optional(),
  values: z.record(z.string(), z.string().max(10000)), fieldSchema: z.array(field).max(250),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role === 'STAFF') return NextResponse.json({ error: 'Cont cu acces doar pentru vizualizare.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele cererii sunt invalide.' }, { status: 400 })
  await ensureFormStorage(businessId)
  const template = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "FormTemplate" WHERE "id"=${parsed.data.formTemplateId} AND "businessId"=${businessId} LIMIT 1`
  if (!template[0]) return NextResponse.json({ error: 'Model inexistent.' }, { status: 404 })
  const id = parsed.data.id || crypto.randomUUID()
  if (parsed.data.id) {
    const changed = Number(await prisma.$executeRaw`UPDATE "FormSubmission" SET "title"=${parsed.data.title}, "sourceType"=${parsed.data.sourceType || null}, "sourceId"=${parsed.data.sourceId || null}, "values"=${JSON.stringify(parsed.data.values)}::jsonb, "fieldSchema"=${JSON.stringify(parsed.data.fieldSchema)}::jsonb, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${businessId}`)
    if (!changed) return NextResponse.json({ error: 'Completarea nu există.' }, { status: 404 })
  } else {
    await prisma.$executeRaw`INSERT INTO "FormSubmission" ("id","businessId","formTemplateId","title","sourceType","sourceId","values","fieldSchema") VALUES (${id},${businessId},${parsed.data.formTemplateId},${parsed.data.title},${parsed.data.sourceType || null},${parsed.data.sourceId || null},${JSON.stringify(parsed.data.values)}::jsonb,${JSON.stringify(parsed.data.fieldSchema)}::jsonb)`
  }
  revalidatePath('/dashboard/formulare')
  return NextResponse.json({ id })
}