import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'

const contactSchema = z.object({
  label: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
})

export async function GET() {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureConnectionStorage()
  const contacts = await prisma.$queryRaw<Array<{ id: string; label: string; email: string }>>`
    SELECT "id", "label", "email" FROM "MunicipalityEmail"
    WHERE "businessId"=${access.businessId}
    ORDER BY lower("label"), lower("email")
  `
  return NextResponse.json(contacts)
}

export async function POST(request: NextRequest) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate modifica agenda primăriilor.' }, { status: 403 })
  const parsed = contactSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Completează denumirea primăriei și o adresă de e-mail validă.' }, { status: 400 })
  await ensureConnectionStorage()
  const id = crypto.randomUUID()
  const rows = await prisma.$queryRaw<Array<{ id: string; label: string; email: string }>>`
    INSERT INTO "MunicipalityEmail" ("id", "businessId", "label", "email")
    VALUES (${id}, ${access.businessId}, ${parsed.data.label}, ${parsed.data.email.toLowerCase()})
    ON CONFLICT ("businessId", "email") DO UPDATE
      SET "label"=EXCLUDED."label", "updatedAt"=CURRENT_TIMESTAMP
    RETURNING "id", "label", "email"
  `
  return NextResponse.json(rows[0], { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate modifica agenda primăriilor.' }, { status: 403 })
  const id = request.nextUrl.searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'Contact invalid.' }, { status: 400 })
  await ensureConnectionStorage()
  const removed = await prisma.$executeRaw`
    DELETE FROM "MunicipalityEmail" WHERE "id"=${id} AND "businessId"=${access.businessId}
  `
  if (!removed) return NextResponse.json({ error: 'Contactul nu există.' }, { status: 404 })
  return NextResponse.json({ success: true })
}