import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { workedMinutes } from '@/lib/attendance'

function csv(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const days = Math.min(366, Math.max(1, Number(req.nextUrl.searchParams.get('days') || 30)))
  const start = new Date(); start.setDate(start.getDate() - days + 1); start.setHours(0, 0, 0, 0)
  const entries = await prisma.timeEntry.findMany({ where: { businessId, clockIn: { gte: start } }, include: { employee: true }, orderBy: { clockIn: 'desc' } })
  const rows = [
    ['Angajat', 'Departament', 'Data', 'Intrare', 'Ieșire', 'Pauză minute', 'Ore lucrate'],
    ...entries.map(e => [
      `${e.employee.firstName} ${e.employee.lastName}`,
      e.employee.department ?? '',
      e.clockIn.toLocaleDateString('ro-RO'),
      e.clockIn.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
      e.clockOut?.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) ?? 'În lucru',
      e.breakMinutes,
      (workedMinutes(e.clockIn, e.clockOut, e.breakMinutes) / 60).toFixed(2),
    ]),
  ]
  const body = '\uFEFF' + rows.map(row => row.map(csv).join(',')).join('\r\n')
  return new NextResponse(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="pontifix-pontaje-${days}-zile.csv"` } })
}
