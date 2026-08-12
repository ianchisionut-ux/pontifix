import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createPasswordToken, sendPasswordSetupEmail, withEmailTimeout } from '@/lib/password-tokens'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug-ul poate conține doar litere mici, cifre și cratime.'),
  name: z.string().min(2),
  email: z.string().email(),
  category: z.enum(['SALON', 'EVENT_VENUE', 'HOTEL', 'PENSIUNE', 'CLINICA']),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { slug, name, email, category } = parsed.data

  const [slugTaken, emailTaken] = await Promise.all([
    prisma.business.findUnique({ where: { slug } }),
    prisma.user.findUnique({ where: { email } }),
  ])
  if (slugTaken) return NextResponse.json({ error: 'Slug-ul există deja.' }, { status: 409 })
  if (emailTaken) return NextResponse.json({ error: 'Există deja un cont cu acest email.' }, { status: 409 })

  const business = await prisma.business.create({
    data: { slug, name, category, publicListed: false, onboardingStep: 1, onboardingDone: false },
  })

  // parolă temporară, aleatorie, imposibil de folosit — clientul o setează singur prin
  // link-ul trimis pe email, ca prim pas de "verificare" a adresei lui reale
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
  const user = await prisma.user.create({
    data: { email, password: unusablePassword, role: 'OWNER', businessId: business.id },
  })

  const token = await createPasswordToken(user.id)

  // trimitem cu timeout strict — businessul e deja creat, chiar dacă emailul întârzie
  // sau eșuează, poți retrimite linkul manual din panoul businessului
  await withEmailTimeout(sendPasswordSetupEmail(email, name, token))

  return NextResponse.json({ business })
}
