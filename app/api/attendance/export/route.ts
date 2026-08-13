import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function csv(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const days = Math.min(366, Math.max(1, Number(req.nextUrl.searchParams.get('days') || 30)))
  const today = new Date()
  const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const startDate = new Date(endDate)
  startDate.setUTCDate(startDate.getUTCDate() - days + 1)
  const entries = await prisma.dailyAttendance.findMany({ where: { businessId, workDate: { gte: startDate, lte: endDate } }, include: { employee: true }, orderBy: [{ workDate: 'desc' }, { employee: { lastName: 'asc' } }] })
  const statusLabels: Record<string, string> = { PRESENT: 'Prezent', REMOTE: 'Distanță', VACATION: 'Concediu', MEDICAL: 'Medical', DAY_OFF: 'Zi liberă', ABSENT: 'Absent' }
  const rows = [
    ['Angajat', 'Categorie', 'Departament', 'Data', 'Stare', 'Ore', 'Notiță'],
    ...entries.map((entry) => [
      `${entry.employee.lastName} ${entry.employee.firstName}`,
      entry.employee.category === 'TESA' ? 'TESA' : 'PRODUCȚIE',
      entry.employee.department ?? '',
      entry.workDate.toLocaleDateString('ro-RO', { timeZone: 'UTC' }),
      statusLabels[entry.status] || entry.status,
      entry.hours.toFixed(2),
      entry.note ?? '',
    ]),
  ]
  const body = '\uFEFF' + rows.map((row) => row.map(csv).join(',')).join('\r\n')
  return new NextResponse(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="pontifix-pontaje-${days}-zile.csv"` } })
}
