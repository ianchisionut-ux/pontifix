import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureFormStorage } from '@/lib/ensure-form-storage'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureFormStorage(businessId)
  const { id } = await params
  const changed = Number(await prisma.$executeRaw`DELETE FROM "FormSubmission" WHERE "id"=${id} AND "businessId"=${businessId}`)
  if (!changed) return NextResponse.json({ error: 'Completarea nu există.' }, { status: 404 })
  revalidatePath('/dashboard/formulare')
  return NextResponse.json({ success: true })
}
