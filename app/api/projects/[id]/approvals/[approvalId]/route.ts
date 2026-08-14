import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureProjectAuthorizationStorage } from '@/lib/ensure-project-authorization-storage'
import { z } from 'zod'

const schema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  institution: z.string().trim().nullable().optional(),
  status: z.enum(['REQUIRED', 'SUBMITTED', 'OBTAINED', 'NOT_REQUIRED']).optional(),
  submittedAt: z.string().nullable().optional(),
  obtainedAt: z.string().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  documentUrl: z.string().trim().nullable().optional(),
  documentName: z.string().trim().nullable().optional(),
})

async function owned(id: string, approvalId: string, businessId: string) {
  return prisma.projectApproval.findFirst({
    where: { id: approvalId, projectId: id, project: { businessId } },
    select: { id: true, documentUrl: true, obtainedAt: true },
  })
}

function refreshProjectPages() {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/proiecte')
  revalidatePath('/dashboard/rapoarte')
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; approvalId: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate modifica proiectele.' }, { status: 403 })

  await ensureProjectAuthorizationStorage()
  const { id, approvalId } = await params
  const approval = await owned(id, approvalId, businessId)
  if (!approval) return NextResponse.json({ error: 'Aviz inexistent.' }, { status: 404 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })

  const { submittedAt, obtainedAt, ...data } = parsed.data
  const hasDocument = Boolean(data.documentUrl || approval.documentUrl)
  await prisma.projectApproval.update({
    where: { id: approvalId },
    data: {
      ...data,
      ...(hasDocument ? { status: 'OBTAINED', obtainedAt: approval.obtainedAt || new Date() } : {}),
      ...(!hasDocument && submittedAt !== undefined ? { submittedAt: submittedAt ? new Date(submittedAt + 'T00:00:00.000Z') : null } : {}),
      ...(!hasDocument && obtainedAt !== undefined ? { obtainedAt: obtainedAt ? new Date(obtainedAt + 'T00:00:00.000Z') : null } : {}),
    },
  })
  await prisma.project.update({ where: { id }, data: { updatedAt: new Date() } })
  refreshProjectPages()
  return NextResponse.json({ success: true, status: hasDocument ? 'OBTAINED' : data.status })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; approvalId: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate modifica proiectele.' }, { status: 403 })

  await ensureProjectAuthorizationStorage()
  const { id, approvalId } = await params
  if (!await owned(id, approvalId, businessId)) return NextResponse.json({ error: 'Aviz inexistent.' }, { status: 404 })
  await prisma.projectApproval.delete({ where: { id: approvalId } })
  refreshProjectPages()
  return NextResponse.json({ success: true })
}
