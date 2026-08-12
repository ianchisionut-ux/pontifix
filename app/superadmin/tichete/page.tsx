import { prisma } from '@/lib/prisma'
import TicketsManager from './tickets-manager'

export default async function TichetePage() {
  const tickets = await prisma.supportTicket.findMany({
    include: { business: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <TicketsManager
      tickets={tickets.map((t) => ({
        id: t.id,
        businessId: t.business.id,
        businessName: t.business.name,
        subject: t.subject,
        message: t.message,
        status: t.status,
        reply: t.reply,
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  )
}
