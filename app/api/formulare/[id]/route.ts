import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureFormStorage } from '@/lib/ensure-form-storage'

const fieldSchema = z.array(z.object({
  id: z.string().min(1).max(100), label: z.string().max(180), page: z.number().int().min(1).max(50),
  x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(.01).max(1),
  height: z.number().min(.01).max(1), fontSize: z.number().min(6).max(40), multiline: z.boolean().optional(),
  binding: z.string().max(150).optional(), defaultValue: z.string().max(4000).optional(),
})).max(250)
const schema = z.object({
  documentPathname: z.string().trim().min(2).max(1000).optional(),
  documentName: z.string().trim().min(1).max(255).optional(),
  fieldSchema: fieldSchema.optional(),
}).refine((data) => data.fieldSchema !== undefined || (!!data.documentPathname && !!data.documentName))

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate modifica modelele.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele modelului sunt invalide.' }, { status: 400 })
  await ensureFormStorage(businessId)
  const { id } = await params
  const exists = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "FormTemplate" WHERE "id"=${id} AND "businessId"=${businessId} LIMIT 1`
  if (!exists[0]) return NextResponse.json({ error: 'Model inexistent.' }, { status: 404 })
  if (parsed.data.documentPathname && parsed.data.documentName) {
    await prisma.$executeRaw`UPDATE "FormTemplate" SET "documentPathname"=${parsed.data.documentPathname}, "documentName"=${parsed.data.documentName}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${businessId}`
  }
  if (parsed.data.fieldSchema) {
    await prisma.$executeRaw`UPDATE "FormTemplate" SET "fieldSchema"=${JSON.stringify(parsed.data.fieldSchema)}::jsonb, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${businessId}`
  }
  revalidatePath('/dashboard/formulare')
  return NextResponse.json({ success: true })
}
