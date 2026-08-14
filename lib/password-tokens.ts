import crypto from 'crypto'
import { prisma } from './prisma'
import { sendBusinessEmail } from './email-settings'

const TOKEN_EXPIRY_HOURS = 24

export async function withEmailTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ])
  } catch (err) {
    console.error('Eroare la trimiterea e-mailului:', err)
    return null
  }
}

export async function createPasswordToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  await prisma.passwordResetToken.create({
    data: { userId, token, expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000) },
  })
  return token
}

export async function sendPasswordSetupEmail(email: string, businessName: string, token: string, businessId?: string | null) {
  const link = `${process.env.APP_URL}/reset-password?token=${token}`
  await sendBusinessEmail(businessId, {
    to: email,
    subject: `Bun venit pe Elmont — configurează-ți contul pentru ${businessName}`,
    html: `
      <p>Salut,</p>
      <p>Contul tău pentru <strong>${businessName}</strong> a fost creat pe Elmont.</p>
      <p>Apasă pe linkul de mai jos ca să-ți setezi parola și să confirmi adresa de e-mail:</p>
      <p><a href="${link}">Setează-ți parola</a></p>
      <p style="color:#888; font-size:13px;">Linkul expiră în 24 de ore.</p>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string, businessId?: string | null) {
  const link = `${process.env.APP_URL}/reset-password?token=${token}`
  await sendBusinessEmail(businessId, {
    to: email,
    subject: 'Resetare parolă — Elmont',
    html: `
      <p>Salut,</p>
      <p>Ai cerut resetarea parolei pentru contul tău Elmont.</p>
      <p><a href="${link}">Setează o parolă nouă</a></p>
      <p style="color:#888; font-size:13px;">Dacă nu ai cerut tu asta, ignoră acest e-mail. Linkul expiră în 24 de ore.</p>
    `,
  })
}
