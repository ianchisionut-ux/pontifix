import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureQuoteStorage } from '@/lib/ensure-quote-storage'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const quoteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(7).max(30),
  serviceType: z.string().trim().min(2).max(100),
  location: z.string().trim().max(180).optional().or(z.literal('')),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  atrPathname: z.string().trim().max(1000).optional().or(z.literal('')),
  atrName: z.string().trim().max(255).optional().or(z.literal('')),
  consent: z.literal(true),
})

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character)
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateLimit(`quote-request:${ip}`, 4, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: 'Ai trimis prea multe cereri. Încearcă din nou mai târziu.' }, { status: 429 })
  }

  const parsed = quoteSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Verifică datele introduse și încearcă din nou.' }, { status: 400 })

  const data = parsed.data
  if (data.atrPathname && !data.atrPathname.startsWith('cereri-oferta/')) {
    return NextResponse.json({ error: 'Document ATR invalid.' }, { status: 400 })
  }

  await ensureQuoteStorage()
  const id = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "QuoteRequest" ("id", "name", "email", "phone", "serviceType", "location", "message", "atrPathname", "atrName")
    VALUES (${id}, ${data.name}, ${data.email.toLowerCase()}, ${data.phone}, ${data.serviceType}, ${data.location || null}, ${data.message || null}, ${data.atrPathname || null}, ${data.atrName || null})
  `

  if (process.env.RESEND_API_KEY && process.env.ADMIN_NOTIFICATION_EMAIL) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    resend.emails.send({
      from: 'Elmont <onboarding@resend.dev>',
      to: process.env.ADMIN_NOTIFICATION_EMAIL,
      subject: `Cerere nouă de ofertă: ${data.serviceType}`,
      html: `<h2>Cerere nouă de ofertă</h2><p><strong>Solicitant:</strong> ${escapeHtml(data.name)}</p><p><strong>Telefon:</strong> ${escapeHtml(data.phone)}</p><p><strong>Email:</strong> ${escapeHtml(data.email)}</p><p><strong>Serviciu:</strong> ${escapeHtml(data.serviceType)}</p><p><strong>Localitate:</strong> ${escapeHtml(data.location || '-')}</p><p><strong>Detalii:</strong> ${escapeHtml(data.message || '-')}</p><p><strong>ATR încărcat:</strong> ${data.atrPathname ? 'Da' : 'Nu'}</p>`,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, id }, { status: 201 })
}
