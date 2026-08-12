import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'
import { z } from 'zod'

const timeValue = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

const schema = z.object({
  name: z.string().min(2),
  contactPhone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  publicListed: z.boolean(),
  teamSize: z.number().min(1).max(200).optional(),
  slotIntervalMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]).nullable().optional(),
  minLeadTimeMinutes: z.number().min(30).max(1440).optional(),
  reminderMinutesBefore: z.number().min(15).max(2880).optional(),
  operatorSilenceMinutes: z.number().min(5).max(240).optional(),
  botBookingEnabled: z.boolean().optional(),
  break1Start: timeValue.nullable().optional(),
  break1End: timeValue.nullable().optional(),
  break2Start: timeValue.nullable().optional(),
  break2End: timeValue.nullable().optional(),
  break3Start: timeValue.nullable().optional(),
  break3End: timeValue.nullable().optional(),
  workingHours: z.array(
    z.object({ weekday: z.number().int().min(0).max(6), startTime: timeValue, endTime: timeValue, closed: z.boolean() })
  ),
}).superRefine((data, ctx) => {
  const breaks = [
    [data.break1Start, data.break1End],
    [data.break2Start, data.break2End],
    [data.break3Start, data.break3End],
  ]
  breaks.forEach(([start, end], index) => {
    if (!!start !== !!end || (start && end && start >= end)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`break${index + 1}Start`], message: 'Pauza trebuie să aibă un interval valid.' })
    }
  })
  data.workingHours.forEach((range, index) => {
    if (!range.closed && range.startTime >= range.endTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workingHours', index], message: 'Ora de început trebuie să fie înaintea orei de final.' })
    }
  })
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { workingHours, ...businessData } = parsed.data

  // re-geocodificăm doar dacă adresa sau orașul chiar s-au schimbat față de ce era
  // salvat — evită apeluri API inutile la fiecare simplă salvare de setări
  const current = await prisma.business.findUnique({ where: { id: businessId } })
  const addressChanged = current && (current.address !== businessData.address || current.city !== businessData.city)

  let coords: { lat: number; lng: number } | null = null
  if (addressChanged && businessData.address && businessData.city) {
    coords = await geocodeAddress(businessData.address, businessData.city)
  }

  await prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: {
        ...businessData,
        ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
      },
    })
    await tx.workingHours.deleteMany({ where: { businessId } })
    await tx.workingHours.createMany({
      data: workingHours.filter((wh) => !wh.closed).map((wh) => ({ businessId, weekday: wh.weekday, startTime: wh.startTime, endTime: wh.endTime })),
    })
  })

  return NextResponse.json({ success: true, geocoded: !!coords })
}
