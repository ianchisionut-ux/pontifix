import { prisma } from './prisma'

export async function getOrCreateEmployeeForUser(userId: string, businessId: string, email: string) {
  const existing = await prisma.attendanceEmployee.findUnique({ where: { userId } })
  if (existing) return existing

  const localPart = email.split('@')[0] || 'angajat'
  const words = localPart.split(/[._-]+/).filter(Boolean)
  const firstName = words[0] ? words[0][0].toUpperCase() + words[0].slice(1) : 'Angajat'
  const lastName = words.slice(1).join(' ') || 'Pontifix'

  return prisma.attendanceEmployee.create({
    data: { businessId, userId, email, firstName, lastName, position: 'Administrator' },
  })
}

export function workedMinutes(clockIn: Date, clockOut: Date | null, breakMinutes = 0) {
  const end = clockOut ?? new Date()
  return Math.max(0, Math.round((end.getTime() - clockIn.getTime()) / 60000) - breakMinutes)
}

export function formatHours(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}
