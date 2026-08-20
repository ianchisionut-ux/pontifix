import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ensureProjectAuthorizationStorage } from '@/lib/ensure-project-authorization-storage'

const schema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  certificateNumber: z.string().trim().nullable().optional(),
  certificateDate: z.string().nullable().optional(),
  beneficiary: z.string().trim().nullable().optional(),
  beneficiaryPhone: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  contractSigned: z.boolean().optional(),
  constructionAuthorizationStatus: z.enum(['REQUIRED', 'SUBMITTED', 'OBTAINED']).optional(),
  documentUrl: z.string().trim().nullable().optional(),
  documentName: z.string().trim().nullable().optional(),
  authorizationDocumentUrl: z.string().trim().nullable().optional(),
  authorizationDocumentName: z.string().trim().nullable().optional(),
})

function refreshProjectPages() {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/proiecte')
  revalidatePath('/dashboard/rapoarte')
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate modifica proiectele.' }, { status: 403 })

  await ensureProjectAuthorizationStorage()
  const { id } = await params
  const found = await prisma.project.findFirst({ where: { id, businessId }, select: { id: true, authorizationDocumentUrl: true } })
  if (!found) return NextResponse.json({ error: 'Proiect inexistent.' }, { status: 404 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })

  const { certificateDate, ...data } = parsed.data
  const hasAuthorizationDocument = Boolean(data.authorizationDocumentUrl || found.authorizationDocumentUrl)
  const normalizedData = {
    ...data,
    ...(hasAuthorizationDocument
      ? { constructionAuthorizationStatus: 'OBTAINED' as const, status: 'COMPLETED' as const }
      : data.constructionAuthorizationStatus === 'OBTAINED'
        ? { status: 'COMPLETED' as const }
        : {}),
  }
  const project = await prisma.project.update({
    where: { id },
    data: {
      ...normalizedData,
      ...(certificateDate !== undefined
        ? { certificateDate: certificateDate ? new Date(certificateDate + 'T00:00:00.000Z') : null }
        : {}),
    },
  })

  refreshProjectPages()
  return NextResponse.json(project)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate modifica proiectele.' }, { status: 403 })

  const { id } = await params
  const result = await prisma.project.deleteMany({ where: { id, businessId } })
  if (!result.count) return NextResponse.json({ error: 'Proiect inexistent.' }, { status: 404 })

  refreshProjectPages()
  return NextResponse.json({ success: true })
}
