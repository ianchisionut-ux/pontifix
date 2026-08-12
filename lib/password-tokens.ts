import crypto from 'crypto'
import { prisma } from './prisma'
import { Resend } from 'resend'

let resendClient: Resend | null = null
function getResend() {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY nu e setat.')
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

const TOKEN_EXPIRY_HOURS = 24

// pe medii serverless (Vercel), funcția se poate opri imediat după ce răspunde —
// "fire and forget" adevărat riscă să nu trimită deloc emailul. Așteptăm trimiterea,
// dar cu un timeout strict, ca să nu blocăm niciodată cererea la nesfârșit dacă
// serviciul de email e lent sau indisponibil.
export async function withEmailTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ])
  } catch (err) {
    console.error('Eroare la trimiterea emailului:', err)
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

export async function sendPasswordSetupEmail(email: string, businessName: string, token: string) {
  const link = `${process.env.APP_URL}/reset-password?token=${token}`
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY lipsește — sar peste trimiterea email-ului de configurare cont.')
    return
  }
  await getResend().emails.send({
    from: 'bookeasy.ro <cont@bookeasy.ro>',
    to: email,
    subject: `Bun venit pe bookeasy.ro — configurează-ți contul pentru ${businessName}`,
    html: `
      <p>Salut,</p>
      <p>Contul tău pentru <strong>${businessName}</strong> a fost creat pe bookeasy.ro.</p>
      <p>Apasă pe linkul de mai jos ca să-ți setezi parola și să confirmi adresa de email:</p>
      <p><a href="${link}">Setează-ți parola</a></p>
      <p style="color:#888; font-size:13px;">Linkul expiră în 24 de ore.</p>
    `,
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${process.env.APP_URL}/reset-password?token=${token}`
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY lipsește — sar peste trimiterea email-ului de resetare parolă.')
    return
  }
  await getResend().emails.send({
    from: 'bookeasy.ro <cont@bookeasy.ro>',
    to: email,
    subject: 'Resetare parolă — bookeasy.ro',
    html: `
      <p>Salut,</p>
      <p>Ai cerut resetarea parolei pentru contul tău bookeasy.ro.</p>
      <p><a href="${link}">Setează o parolă nouă</a></p>
      <p style="color:#888; font-size:13px;">Dacă nu ai cerut tu asta, ignoră acest email. Linkul expiră în 24 de ore.</p>
    `,
  })
}
