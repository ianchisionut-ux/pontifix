import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { connectionFieldsSchema } from '@/lib/connection-fields'
import { ensureConnectionStorage } from '@/lib/ensure-connection-storage'
import { CONNECTION_STATUSES } from '@/lib/connection-status'
import { connectionIdentityFromContract } from '@/lib/connection-store'
import { deerSubmissionSchema } from '@/lib/deer-submission'

const updateSchema = z.object({
  fields: connectionFieldsSchema.optional(),
  status: z.enum(CONNECTION_STATUSES).optional(),
  deerSubmittedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  deerSubmission: deerSubmissionSchema.optional(),
}).refine((value) => value.fields || value.status || value.deerSubmittedAt !== undefined || value.deerSubmission, 'Nicio modificare.')

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  const modifiesCase = Boolean(parsed.data.fields || parsed.data.status)
  if (modifiesCase && !access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate modifica branșamentul.' }, { status: 403 })
  if (parsed.data.deerSubmittedAt !== undefined && !access.canEditDeerDate) return NextResponse.json({ error: 'Nu ai acces la registrul DEER.' }, { status: 403 })
  if (parsed.data.deerSubmission && !access.canEditDeerDate) return NextResponse.json({ error: 'Nu ai acces la depunerile DEER.' }, { status: 403 })
  await ensureConnectionStorage()
  const { id } = await params
  let changed = 0
  let savedIdentity: { sequenceNumber: number; nib: string } | null = null
  try {
    if (parsed.data.fields) {
      const rows = await prisma.$queryRaw<Array<{ createdAt: Date }>>`SELECT "createdAt" FROM "ConnectionCase" WHERE "id"=${id} AND "businessId"=${access.businessId} LIMIT 1`
      if (!rows[0]) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
      const identity = connectionIdentityFromContract(parsed.data.fields.NrContract, rows[0].createdAt.getUTCFullYear())
      savedIdentity = identity
      changed = Number(await prisma.$executeRaw`UPDATE "ConnectionCase" SET "fields"=${JSON.stringify(parsed.data.fields)}::jsonb, "sequenceNumber"=${identity.sequenceNumber}, "nib"=${identity.nib}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${access.businessId}`)
    }
    if (parsed.data.status) changed = Number(await prisma.$executeRaw`UPDATE "ConnectionCase" SET "status"=${parsed.data.status}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${access.businessId}`)
    if (parsed.data.deerSubmittedAt !== undefined) {
      const deerSubmittedAt = parsed.data.deerSubmittedAt ? new Date(`${parsed.data.deerSubmittedAt}T00:00:00.000Z`) : null
      changed = Number(await prisma.$executeRaw`UPDATE "ConnectionCase" SET "deerSubmittedAt"=${deerSubmittedAt}, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${access.businessId}`)
    }
    if (parsed.data.deerSubmission) changed = Number(await prisma.$executeRaw`UPDATE "ConnectionCase" SET "deerSubmission"=${JSON.stringify(parsed.data.deerSubmission)}::jsonb, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${access.businessId}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('unique') || message.includes('duplicate')) return NextResponse.json({ error: 'Acest Număr contract este deja folosit de alt branșament.' }, { status: 409 })
    if (message.includes('Număr contract')) return NextResponse.json({ error: message }, { status: 400 })
    throw error
  }
  if (!changed) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  return NextResponse.json({ success: true, ...savedIdentity })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate șterge branșamente.' }, { status: 403 })
  await ensureConnectionStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ atrPathname: string | null }>>`SELECT "atrPathname" FROM "ConnectionCase" WHERE "id"=${id} AND "businessId"=${access.businessId} LIMIT 1`
  if (!rows[0]) return NextResponse.json({ error: 'Branșament inexistent.' }, { status: 404 })
  await prisma.$executeRaw`DELETE FROM "ConnectionCase" WHERE "id"=${id} AND "businessId"=${access.businessId}`
  if (rows[0].atrPathname) await del(rows[0].atrPathname).catch(() => undefined)
  return NextResponse.json({ success: true })
}
