import crypto from 'crypto'

export function signCalendarState(payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', process.env.AUTH_SECRET ?? '').update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyCalendarState(state: string) {
  const [encoded, signature] = state.split('.')
  if (!encoded || !signature) throw new Error('Stare OAuth invalidă.')
  const expected = crypto.createHmac('sha256', process.env.AUTH_SECRET ?? '').update(encoded).digest('base64url')
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('Stare OAuth invalidă.')
  const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as { businessId: string; practitionerId: string; expiresAt: number }
  if (parsed.expiresAt < Date.now()) throw new Error('Conectarea a expirat.')
  return parsed
}
