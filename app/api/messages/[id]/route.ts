import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureMessageStorage } from '@/lib/ensure-message-storage'

const patchSchema = z.object({ status: z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED']).optional(), internalNote: z.string().trim().max(2000).nullable().optional() })

async function access() {
  const session = await auth()
  return (session as any)?.businessId as string | undefined
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await access(); if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const parsed = patchSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  await ensureMessageStorage(); const { id } = await params
  const status = parsed.data.status; const note = parsed.data.internalNote
  await prisma.$executeRaw`UPDATE "CustomerMessage" SET "status"=COALESCE(${status || null}, "status"), "internalNote"=CASE WHEN ${note === undefined} THEN "internalNote" ELSE ${note ?? null} END, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND ("businessId"=${businessId} OR "businessId" IS NULL)`
  return NextResponse.json({ success: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await access(); if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureMessageStorage(); const { id } = await params
  await prisma.$executeRaw`DELETE FROM "CustomerMessage" WHERE "id"=${id} AND ("businessId"=${businessId} OR "businessId" IS NULL)`
  return NextResponse.json({ success: true })
}