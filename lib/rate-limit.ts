// Limitator simplu, în memorie — suficient cât timp rulăm pe o singură regiune Vercel cu
// trafic moderat. Dacă traficul crește mult sau rulăm pe mai multe regiuni, ar trebui
// înlocuit cu unul distribuit (ex: Upstash Redis), pentru că memoria nu e împărtășită
// între instanțe serverless diferite — dar chiar și așa, reduce semnificativ abuzul simplu.

const buckets = new Map<string, { count: number; resetAt: number }>()

// curățare periodică, ca să nu crească Map-ul la nesfârșit
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key)
  }
}, 5 * 60 * 1000).unref?.()

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  bucket.count++
  return { allowed: true, remaining: limit - bucket.count }
}

// extrage un identificator rezonabil de client din request — IP-ul din headerele
// standard puse de Vercel în fața funcțiilor serverless
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
