import { prisma } from './prisma'

// numărul rezervării în luna curentă — resetat automat la începutul fiecărei luni,
// util pentru referință rapidă ("rezervarea #007") fără să depinzi de ID-ul tehnic
export async function getNextSequenceNumber(businessId: string, date: Date): Promise<number> {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1)

  const count = await prisma.booking.count({
    where: { businessId, createdAt: { gte: monthStart, lt: monthEnd } },
  })

  return count + 1
}
