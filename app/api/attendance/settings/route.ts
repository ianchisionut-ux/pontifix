import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const schema = z.object({
  companyName: z.string().trim().min(2).max(100),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: time,
  endTime: time,
  breakStart: time.optional().or(z.literal('')),
  breakEnd: time.optional().or(z.literal('')),
}).refine((data) => data.endTime > data.startTime, { message: 'Ora de sfârșit trebuie să fie după ora de început.' })
  .refine((data) => (!data.breakStart && !data.breakEnd) || (!!data.breakStart && !!data.breakEnd && data.breakEnd > data.breakStart), { message: 'Completează corect intervalul pauzei.' })

export async function PUT(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Date invalide.' }, { status: 400 })
  const { companyName, weekdays, startTime, endTime, breakStart, breakEnd } = parsed.data

  await prisma.$transaction([
    prisma.business.update({
      where: { id: businessId },
      data: { name: companyName, break1Start: breakStart || null, break1End: breakEnd || null },
    }),
    prisma.workingHours.deleteMany({ where: { businessId } }),
    prisma.workingHours.createMany({ data: weekdays.map((weekday) => ({ businessId, weekday, startTime, endTime })) }),
  ])
  return NextResponse.json({ success: true })
}
