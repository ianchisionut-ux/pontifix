import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { z } from 'zod'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { createConnectionCase } from '@/lib/connection-store'

const createSchema = z.object({
  fields: connectionFieldsSchema,
  atrPathname: z.string().trim().max(1000).nullable().optional(),
  atrName: z.string().trim().max(255).nullable().optional(),
  overwriteExisting: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate crea branșamente.' }, { status: 403 })
  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datele branșamentului sunt invalide.' }, { status: 400 })
  const { fields, atrPathname = null, atrName = null, overwriteExisting = false } = parsed.data
  if (atrPathname && !atrPathname.startsWith('bransamente/')) return NextResponse.json({ error: 'Cale ATR invalidă.' }, { status: 400 })
  if (overwriteExisting && !atrPathname) return NextResponse.json({ error: 'Suprascrierea necesită un ATR nou.' }, { status: 400 })
  await ensureConnectionStorage()
  const createdByEmail = access.session?.user?.email || null
  try {
    const result = await createConnectionCase({ businessId: access.businessId, fields, atrPathname, atrName, createdByEmail, overwriteExisting })
    if (result.updated && result.previousAtrPathname && result.previousAtrPathname !== atrPathname) {
      del(result.previousAtrPathname).catch((error) => console.error('Old ATR cleanup failed:', error))
    }
    return NextResponse.json({ success: true, ...result }, { status: result.created ? 201 : 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Branșamentul nu a putut fi creat.' }, { status: 409 })
  }
}
