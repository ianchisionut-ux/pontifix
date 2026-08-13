import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getOfferAccess } from '@/lib/offer-access'

const updateSchema = z.object({
  status: z.enum(['NEW', 'REVIEWING', 'QUOTED', 'ACCEPTED', 'REJECTED', 'ARCHIVED']).optional(),
  internalNotes: z.string().trim().max(4000).nullable().optional(),
  estimatedValue: z.number().min(0).max(1_000_000_000).nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await ensureQuoteStorage()
  const { id } = await params
  const current = await prisma.$queryRaw<Array<{ status: string; internalNotes: string | null; estimatedValue: number | null }>>`
    SELECT "status", "internalNotes", "estimatedValue" FROM "QuoteRequest"
    WHERE "id" = ${id} AND ("businessId" = ${access.businessId} OR "businessId" IS NULL) LIMIT 1
  `
  if (!current[0]) return NextResponse.json({ error: 'Cererea nu există.' }, { status: 404 })
  const next = { ...current[0], ...parsed.data }
  await prisma.$executeRaw`
    UPDATE "QuoteRequest" SET "status" = ${next.status}, "internalNotes" = ${next.internalNotes},
      "estimatedValue" = ${next.estimatedValue}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND ("businessId" = ${access.businessId} OR "businessId" IS NULL)
  `
  revalidatePath('/dashboard/oferte')
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOfferAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureQuoteStorage()
  const { id } = await params
  const removed = await prisma.$executeRaw`
    DELETE FROM "QuoteRequest" WHERE "id" = ${id} AND ("businessId" = ${access.businessId} OR "businessId" IS NULL)
  `
  if (!removed) return NextResponse.json({ error: 'Cererea nu există.' }, { status: 404 })
  revalidatePath('/dashboard/oferte')
  return NextResponse.json({ success: true })
}
