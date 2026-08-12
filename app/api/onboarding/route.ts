import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'
import { ensureVenueService } from '@/lib/venue-services'
import { z } from 'zod'

const stepSchemas = {
  1: z.object({
    name: z.string().min(2),
    category: z.enum(['SALON', 'EVENT_VENUE']).optional(),
    contactPhone: z.string(),
    city: z.string(),
    address: z.string().optional(),
  }),
  2: z.object({
    workingHours: z.array(z.object({ weekday: z.number(), startTime: z.string(), endTime: z.string() })),
  }),
  3: z.object({
    services: z.array(
      z.object({
        name: z.string(),
        durationMin: z.number().nullable().optional(),
        price: z.number().nullable().optional(),
        capacity: z.number().nullable().optional(),
      })
    ),
  }),
  4: z.object({
    staff: z.array(z.object({ name: z.string() })).optional().default([]),
  }),
  5: z.object({}),
} as const

// GET — folosit de paginile de onboarding ca să știe categoria aleasă la pasul 1
// (necesar la pasul 3, unde formularul diferă radical între SALON și EVENT_VENUE)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({
    category: business.category,
    onboardingStep: business.onboardingStep,
    onboardingDone: business.onboardingDone,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { step, data } = await req.json()
  const schema = stepSchemas[step as keyof typeof stepSchemas]
  if (!schema) return NextResponse.json({ error: 'invalid step' }, { status: 400 })

  const parsed = schema.safeParse(data ?? {})
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const businessId = (session as any).businessId
  await saveOnboardingStep(businessId, step, parsed.data)

  await prisma.business.update({
    where: { id: businessId },
    data: {
      onboardingStep: Math.min(step + 1, 5),
      onboardingDone: step >= 5,
      ...(step >= 5 ? { publicListed: true } : {}),
    },
  })

  return NextResponse.json({ nextStep: step + 1 })
}

async function saveOnboardingStep(businessId: string, step: number, data: any) {
  if (step === 1) {
    const coords = data.address ? await geocodeAddress(data.address, data.city) : null
    await prisma.business.update({
      where: { id: businessId },
      data: { ...data, ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}) },
    })
  }

  if (step === 2) {
    await prisma.workingHours.deleteMany({ where: { businessId } })
    await prisma.workingHours.createMany({ data: data.workingHours.map((wh: any) => ({ ...wh, businessId })) })
  }

  if (step === 3) {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (business?.category === 'EVENT_VENUE') {
      await prisma.resource.createMany({
        data: data.services.map((s: any) => ({ businessId, name: s.name, capacity: s.capacity ?? null, basePrice: s.price ?? null })),
      })
      const resources = await prisma.resource.findMany({ where: { businessId } })
      await Promise.all(resources.map((resource) => ensureVenueService(resource)))
    } else {
      await prisma.service.createMany({
        data: data.services.map((s: any) => ({
          businessId,
          name: s.name,
          type: 'APPOINTMENT',
          durationMin: s.durationMin ?? null,
          price: s.price ?? null,
        })),
      })
    }
  }

  if (step === 4 && data.staff?.length) {
    await prisma.staff.createMany({ data: data.staff.map((s: any) => ({ businessId, name: s.name })) })
  }

  // pasul 5 nu are date proprii — doar finalizează onboarding-ul (vezi POST handler)
}
