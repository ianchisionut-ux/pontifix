import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureFormStorage } from '@/lib/ensure-form-storage'

const schema = z.object({
  title: z.string().trim().min(2).max(180),
  category: z.enum(['FORMULAR', 'CERERE']).default('FORMULAR'),
  documentPathname: z.string().trim().min(2).max(1000),
  documentName: z.string().trim().min(1).max(255),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate adăuga formulare.' }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele formularului sunt invalide.' }, { status: 400 })
  await ensureFormStorage(businessId)
  const maxRows = await prisma.$queryRaw<Array<{ value: number }>>`SELECT COALESCE(MAX("sortOrder"), -1)::int AS value FROM "FormTemplate" WHERE "businessId"=${businessId} AND "category"=${parsed.data.category}`
  const id = randomUUID()
  await prisma.$executeRaw`INSERT INTO "FormTemplate" ("id", "businessId", "title", "category", "documentPathname", "documentName", "sortOrder") VALUES (${id}, ${businessId}, ${parsed.data.title}, ${parsed.data.category}, ${parsed.data.documentPathname}, ${parsed.data.documentName}, ${(maxRows[0]?.value ?? -1) + 1})`
  revalidatePath('/dashboard/formulare')
  return NextResponse.json({ id }, { status: 201 })
}
