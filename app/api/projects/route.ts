import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  name: z.string().trim().min(2).max(200), certificateNumber: z.string().trim().optional(), certificateDate: z.string().optional(),
  beneficiary: z.string().trim().optional(), address: z.string().trim().optional(), description: z.string().trim().optional(),
  documentUrl: z.string().trim().optional(), documentName: z.string().trim().optional(),
  approvals: z.array(z.object({ name: z.string().trim().min(2), institution: z.string().trim().optional() })).default([]),
})
export async function POST(req: NextRequest) {
  const session = await auth(); const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const parsed = schema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: 'Datele proiectului sunt invalide.' }, { status: 400 })
  const { approvals, certificateDate, ...data } = parsed.data
  const project = await prisma.project.create({ data: { ...data, businessId, uploadedByEmail: session?.user?.email || null, certificateDate: certificateDate ? new Date(certificateDate + 'T00:00:00.000Z') : null, approvals: { create: approvals.map((approval, index) => ({ ...approval, sortOrder: index })) } }, include: { approvals: true } })
  return NextResponse.json(project, { status: 201 })
}