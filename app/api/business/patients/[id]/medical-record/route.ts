import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  cnp: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  occupation: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  familyDoctor: z.string().optional(),
  familyDoctorLastVisit: z.string().optional(),
  previousDentist: z.string().optional(),
  previousDentistLastVisit: z.string().optional(),
  hospitalized: z.boolean().nullable().optional(),
  hospitalizedDetails: z.string().optional(),
  surgeries: z.boolean().nullable().optional(),
  surgeriesDetails: z.string().optional(),
  onMedication: z.boolean().nullable().optional(),
  medicationDetails: z.string().optional(),
  smoker: z.boolean().nullable().optional(),
  allergyAnesthesia: z.boolean().nullable().optional(),
  allergyAntibiotics: z.boolean().nullable().optional(),
  allergyAspirin: z.boolean().nullable().optional(),
  allergyIodine: z.boolean().nullable().optional(),
  allergyLatex: z.boolean().nullable().optional(),
  allergyNickel: z.boolean().nullable().optional(),
  allergyOther: z.string().optional(),
  pregnant: z.boolean().nullable().optional(),
  pregnantMonth: z.string().optional(),
  breastfeeding: z.boolean().nullable().optional(),
  menstruationStarted: z.boolean().nullable().optional(),
  contraceptives: z.boolean().nullable().optional(),
  menopause: z.boolean().nullable().optional(),
  medicalConditions: z.record(z.boolean()).optional(),
  clinicalHistory: z.record(z.any()).optional(),
  pediatricInfo: z.record(z.any()).optional(),
  generalNotes: z.string().optional(),
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

  const record = await prisma.patientMedicalRecord.findUnique({ where: { customerId: id } })
  return NextResponse.json({ record })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await ownsPatient(id, businessId)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })

  const record = await prisma.patientMedicalRecord.upsert({
    where: { customerId: id },
    create: { customerId: id, ...parsed.data },
    update: parsed.data,
  })

  return NextResponse.json({ record })
}
