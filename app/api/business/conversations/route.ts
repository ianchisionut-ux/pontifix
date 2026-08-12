import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const conversations = await prisma.conversation.findMany({
    where: { businessId, operatorRequestedAt: { not: null } },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  if (conversations.length === 0) return NextResponse.json({ conversations: [] })

  // înainte: câte 2 interogări SEPARATE per conversație (până la 200 pentru 100
  // conversații). Acum: exact 2 interogări batch, indiferent de câte conversații sunt —
  // ultimele mesaje relevante într-o singură cerere, clienții cunoscuți în alta
  const messagePairs = conversations.map((c) => ({
    channel: c.channel,
    externalUserId: c.externalUserId,
    // păstrăm exact același prag ca înainte — altfel ar reapărea conversația cu botul
    // dinainte de cererea de operator, bug-ul reparat separat
    ...(c.operatorRequestedAt ? { createdAt: { gte: c.operatorRequestedAt } } : {}),
  }))
  const customerOrConditions = conversations.map((c) =>
    c.channel === 'WHATSAPP'
      ? { phone: c.externalUserId }
      : c.channel === 'INSTAGRAM'
        ? { instagramUserId: c.externalUserId }
        : { facebookUserId: c.externalUserId }
  )

  const [recentMessages, customers] = await Promise.all([
    // luăm un lot generos de mesaje recente pentru toate aceste conversații deodată,
    // ordonate descrescător — primul mesaj întâlnit per conversație e automat cel mai recent
    prisma.chatMessage.findMany({
      where: { businessId, OR: messagePairs },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.customer.findMany({ where: { businessId, OR: customerOrConditions } }),
  ])

  const lastMessageByKey = new Map<string, (typeof recentMessages)[number]>()
  for (const m of recentMessages) {
    const key = `${m.channel}:${m.externalUserId}`
    if (!lastMessageByKey.has(key)) lastMessageByKey.set(key, m)
  }

  const customerByKey = new Map<string, (typeof customers)[number]>()
  for (const cust of customers) {
    if (cust.phone) customerByKey.set(`WHATSAPP:${cust.phone}`, cust)
    if (cust.instagramUserId) customerByKey.set(`INSTAGRAM:${cust.instagramUserId}`, cust)
    if (cust.facebookUserId) customerByKey.set(`FACEBOOK:${cust.facebookUserId}`, cust)
  }

  const enriched = conversations.map((c) => {
    const key = `${c.channel}:${c.externalUserId}`
    const lastMessage = lastMessageByKey.get(key)
    const customer = customerByKey.get(key)

    return {
      id: c.id,
      channel: c.channel,
      externalUserId: c.externalUserId,
      customerName: customer?.name ?? null,
      customerId: customer?.id ?? null,
      needsOperator: c.needsOperator,
      updatedAt: c.updatedAt.toISOString(),
      lastMessage: lastMessage ? { text: lastMessage.text, direction: lastMessage.direction, createdAt: lastMessage.createdAt.toISOString() } : null,
    }
  })

  // conversațiile care așteaptă un operator, primele — restul, după cea mai recentă activitate
  enriched.sort((a, b) => {
    if (a.needsOperator !== b.needsOperator) return a.needsOperator ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return NextResponse.json({ conversations: enriched })
}
