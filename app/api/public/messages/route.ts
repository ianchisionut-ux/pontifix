import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureMessageStorage } from '@/lib/ensure-message-storage'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  message: z.string().trim().min(3).max(1500),
}).refine((data) => !!data.email || !!data.phone, { message: 'Completează telefonul sau e-mailul.' })

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(`customer-message:${ip}`, 6, 60 * 60 * 1000).allowed) return NextResponse.json({ error: 'Ai trimis prea multe mesaje. Încearcă mai târziu.' }, { status: 429 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Verifică datele introduse.' }, { status: 400 })
  await ensureMessageStorage()
  const business = await prisma.business.findFirst({ where: { name: { contains: 'Elmont', mode: 'insensitive' } }, select: { id: true } })
  const data = parsed.data
  await prisma.$executeRaw`
    INSERT INTO "CustomerMessage" ("id", "businessId", "name", "email", "phone", "message")
    VALUES (${crypto.randomUUID()}, ${business?.id || null}, ${data.name}, ${data.email?.toLowerCase() || null}, ${data.phone || null}, ${data.message})
  `
  return NextResponse.json({ success: true }, { status: 201 })
}
