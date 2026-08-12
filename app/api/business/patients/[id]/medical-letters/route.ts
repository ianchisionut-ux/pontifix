import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  providerName: z.string().optional(),
  doctorName: z.string().optional(),
  contractNumber: z.string().optional(),
  casName: z.string().optional(),
  patientName: z.string().optional(),
  patientBirthDate: z.string().optional(),
  patientCnp: z.string().optional(),
  consultationDate: z.string().optional(),
  hospitalizationPeriod: z.string().optional(),
  fileNumber: z.string().optional(),
  presentationReasons: z.string().optional(),
  oncologicalDiagnosis: z.boolean().nullable().optional(),
  diagnosis: z.string().optional(),
  anamnesis: z.string().optional(),
  riskFactors: z.string().optional(),
  clinicalExamGeneral: z.string().optional(),
  clinicalExamLocal: z.string().optional(),
  labNormal: z.string().optional(),
  labPathological: z.string().optional(),
  ekg: z.string().optional(),
  eco: z.string().optional(),
  rx: z.string().optional(),
  otherParaclinical: z.string().optional(),
  treatmentGiven: z.string().optional(),
  otherHealthInfo: z.string().optional(),
  recommendedTreatment: z.string().optional(),
  returnForHospitalization: z.string().optional(),
  prescriptionStatus: z.string().optional(),
  medicalLeaveStatus: z.string().optional(),
  homeCareStatus: z.string().optional(),
  deviceStatus: z.string().optional(),
  letterDate: z.string().optional(),
})

async function ownsPatient(customerId: string, businessId: string) {
  const c = await prisma.customer.findUnique({ where: { id: customerId } })
  return c && c.businessId === businessId ? c : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await ownsPatient(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const letters = await prisma.medicalLetter.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ letters })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await ownsPatient(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })

  const letter = await prisma.medicalLetter.create({ data: { customerId: id, businessId, ...parsed.data } })
  return NextResponse.json({ letter })
}
