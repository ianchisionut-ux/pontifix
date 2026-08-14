import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPasswordToken, sendPasswordResetEmail, withEmailTimeout } from '@/lib/password-tokens'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const ipCheck = rateLimit(`forgot-pw-ip:${ip}`, 5, 15 * 60 * 1000) // 5/15min/IP
  if (!ipCheck.allowed) {
    return NextResponse.json({ error: 'Prea multe încercări. Așteaptă câteva minute.' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Email invalid.' }, { status: 400 })

  // limitare și pe email — ca cineva să nu poată bombarda inbox-ul unei singure victime
  const emailCheck = rateLimit(`forgot-pw-email:${parsed.data.email.toLowerCase()}`, 3, 60 * 60 * 1000) // 3/oră/email
  if (!emailCheck.allowed) {
    return NextResponse.json({ success: true }) // răspuns normal, nu confirmăm limita — nu vrem să dezvăluim nimic
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })

  // răspundem la fel indiferent dacă emailul există sau nu — nu confirmăm/infirmăm
  // existența unui cont, ca să nu putem fi folosiți pentru a "ghici" clienți înregistrați
  if (user) {
    const token = await createPasswordToken(user.id)
    await withEmailTimeout(sendPasswordResetEmail(user.email, token, user.businessId))
  }

  return NextResponse.json({ success: true })
}
