import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureProjectAuthorizationStorage } from '@/lib/ensure-project-authorization-storage'
import { ensureTenderStorage } from '@/lib/tenders'

const schema = z.object({
  name: z.string().trim().min(2).max(200),
  beneficiary: z.string().trim().max(200).default(''),
  address: z.string().trim().max(500).default(''),
  approvals: z.array(z.string().trim().min(2).max(160)).max(30).default([]),
})

type TenderSource = {
  id: string
  title: string
  noticeNumber: string | null
  contractingAuthority: string | null
  procedureType: string | null
  cpvCode: string | null
  deadline: string
  estimatedValue: number | null
  currency: string
  seapUrl: string | null
  notes: string | null
  status: string
  projectId: string | null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Doar Super Adminul poate crea proiecte.' }, { status: 403 })
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Licitație invalidă.' }, { status: 400 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Verifică datele proiectului și avizele selectate.' }, { status: 400 })
  await Promise.all([ensureTenderStorage(), ensureProjectAuthorizationStorage()])

  const result = await prisma.$transaction(async tx => {
    const [tender] = await tx.$queryRaw<TenderSource[]>`
      SELECT "id", "title", "noticeNumber", "contractingAuthority", "procedureType", "cpvCode", "deadline", "estimatedValue",
        "currency", "seapUrl", "notes", "status", "projectId"
      FROM "Tender" WHERE "id"=${id} AND "businessId"=${businessId} FOR UPDATE
    `
    if (!tender) return { error: 'Licitația nu a fost găsită.', status: 404 }
    if (tender.projectId) {
      const existing = await tx.project.findFirst({ where: { id: tender.projectId, businessId }, select: { id: true } })
      if (existing) return { projectId: existing.id, created: false }
    }
    if (tender.status !== 'CASTIGATA') return { error: 'Marchează licitația drept câștigată înainte de conversie.', status: 400 }

    const uniqueApprovals = [...new Set(parsed.data.approvals.map(name => name.trim()).filter(Boolean))]
    const details = [
      tender.noticeNumber && `Număr SEAP: ${tender.noticeNumber}`,
      tender.contractingAuthority && `Autoritate contractantă: ${tender.contractingAuthority}`,
      tender.procedureType && `Tip procedură: ${tender.procedureType}`,
      tender.cpvCode && `Cod CPV: ${tender.cpvCode}`,
      `Termen depunere: ${tender.deadline.replace('T', ' ')}`,
      tender.estimatedValue !== null && `Valoare estimată: ${tender.estimatedValue} ${tender.currency}`,
      tender.seapUrl && `Link SEAP: ${tender.seapUrl}`,
      tender.notes && `Note licitație: ${tender.notes}`,
    ].filter(Boolean).join('\n')
    const project = await tx.project.create({
      data: {
        businessId,
        name: parsed.data.name,
        beneficiary: parsed.data.beneficiary || null,
        address: parsed.data.address || null,
        description: details,
        isTender: true,
        uploadedByEmail: session?.user?.email || null,
        approvals: { create: uniqueApprovals.map((name, sortOrder) => ({ name, sortOrder })) },
      },
      select: { id: true },
    })
    await tx.$executeRaw`UPDATE "Tender" SET "projectId"=${project.id}, "updatedAt"=NOW() WHERE "id"=${id} AND "businessId"=${businessId}`
    return { projectId: project.id, created: true }
  }, { maxWait: 10_000, timeout: 30_000 })

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  revalidatePath('/dashboard/proiecte')
  revalidatePath('/dashboard/licitatii')
  return NextResponse.json(result, { status: result.created ? 201 : 200 })
}
