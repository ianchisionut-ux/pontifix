import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendAccessRequestNotification } from '@/lib/email'
import { withEmailTimeout } from '@/lib/password-tokens'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  businessName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  category: z.enum(['SALON', 'EVENT_VENUE', 'HOTEL', 'PENSIUNE', 'CLINICA']).optional(),
  message: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const { allowed } = rateLimit(`access-request:${ip}`, 3, 60 * 60 * 1000) // 3/oră/IP
  if (!allowed) {
    return NextResponse.json({ error: 'Prea multe încercări. Așteaptă puțin.' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Completează toate câmpurile obligatorii.' }, { status: 400 })

  const request = await prisma.accessRequest.create({ data: parsed.data })

  await withEmailTimeout(
    sendAccessRequestNotification({
      name: parsed.data.name,
      businessName: parsed.data.businessName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      category: parsed.data.category ?? null,
      message: parsed.data.message ?? null,
    })
  )

  return NextResponse.json({ success: true, id: request.id })
}
