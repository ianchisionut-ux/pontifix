import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'

const createSchema = z.object({
  fields: connectionFieldsSchema,
  atrPathname: z.string().trim().max(1000).nullable().optional(),
  atrName: z.string().trim().max(255).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate crea branșamente.' }, { status: 403 })
  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele branșamentului sunt invalide.' }, { status: 400 })
  const { fields, atrPathname = null, atrName = null } = parsed.data
  if (atrPathname && !atrPathname.startsWith('bransamente/')) return NextResponse.json({ error: 'Cale ATR invalidă.' }, { status: 400 })
  await ensureConnectionStorage()
  const id = crypto.randomUUID()
  const fieldsJson = JSON.stringify(fields)
  const createdByEmail = access.session?.user?.email || null
  await prisma.$executeRaw`
    INSERT INTO "ConnectionCase" ("id", "businessId", "fields", "atrPathname", "atrName", "createdByEmail")
    VALUES (${id}, ${access.businessId}, CAST(${fieldsJson} AS JSONB), ${atrPathname}, ${atrName}, ${createdByEmail})
  `
  return NextResponse.json({ success: true, id }, { status: 201 })
}
