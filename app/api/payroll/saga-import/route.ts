import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensurePayrollSchema } from '@/lib/payroll-storage'
import { generatePayroll } from '@/lib/payroll'
import { parseSagaFile } from '@/lib/saga-import'

async function findEmployee(businessId: string, row: Awaited<ReturnType<typeof parseSagaFile>>[number]) {
  const identities = [
    ...(row.cnp ? [{ cnp: row.cnp }] : []), ...(row.contractNumber ? [{ contractNumber: row.contractNumber }] : []),
    ...(row.email ? [{ email: row.email }] : []),
  ]
  if (!identities.length) return null
  return prisma.attendanceEmployee.findFirst({ where: { businessId, OR: identities } })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId || (session as any)?.role === 'STAFF') return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  try {
    await ensurePayrollSchema()
    const form = await req.formData()
    const file = form.get('file')
    const commit = form.get('commit') === '1'
    const month = String(form.get('month') || '')
    if (!(file instanceof File) || file.size === 0) throw new Error('Selectează fișierul exportat din SAGA.')
    if (file.size > 10 * 1024 * 1024) throw new Error('Fișierul nu poate depăși 10 MB.')
    const records = await parseSagaFile(file)
    const invalid = records.filter((row) => (!row.cnp && !row.contractNumber && !row.email) || (row.cnp && row.cnp.length !== 13))
    const preview = await Promise.all(records.map(async (row) => ({ ...row, match: (await findEmployee(businessId, row))?.id || null })))
    if (!commit) return NextResponse.json({ records: preview.slice(0, 500), total: records.length,
      existing: preview.filter((row) => row.match).length, newEmployees: preview.filter((row) => !row.match).length,
      salaryRows: preview.filter((row) => row.grossIncome != null || row.netSalary != null).length,
      invalidRows: invalid.map((row) => row.row) })

    if (invalid.length) throw new Error(`Rândurile ${invalid.map((row) => row.row).join(', ')} nu au CNP valid, număr contract sau e-mail. Importul a fost oprit pentru a evita dublurile.`)
    if (month && records.some((row) => row.grossIncome != null || row.netSalary != null)) {
      const current = await prisma.payrollRun.findUnique({ where: { businessId_month: { businessId, month } } })
      if (current?.status === 'FINALIZED') throw new Error('Statul lunii selectate este finalizat și nu poate fi suprascris.')
    }

    let created = 0, updated = 0
    const imported: Array<{ employeeId: string; row: typeof records[number] }> = []
    await prisma.$transaction(async (tx) => {
      for (const row of records) {
        const identities = [
          ...(row.cnp ? [{ cnp: row.cnp }] : []), ...(row.contractNumber ? [{ contractNumber: row.contractNumber }] : []),
          ...(row.email ? [{ email: row.email }] : []),
        ]
        const existing = await tx.attendanceEmployee.findFirst({ where: { businessId, OR: identities } })
        const data = { firstName: row.firstName || existing?.firstName || 'Necunoscut', lastName: row.lastName || existing?.lastName || 'Salariat',
          email: row.email || existing?.email || null, phone: row.phone || existing?.phone || null, position: row.position || existing?.position || null,
          department: row.department || existing?.department || null, cnp: row.cnp || existing?.cnp || null,
          contractNumber: row.contractNumber || existing?.contractNumber || null,
          contractDate: row.contractDate ? new Date(`${row.contractDate}T00:00:00Z`) : existing?.contractDate || null,
          hiredAt: row.hiredAt ? new Date(`${row.hiredAt}T00:00:00Z`) : existing?.hiredAt || new Date(),
          iban: row.iban || existing?.iban || null, grossSalary: row.grossSalary || existing?.grossSalary || row.grossIncome || 0 }
        const employee = existing
          ? await tx.attendanceEmployee.update({ where: { id: existing.id }, data })
          : await tx.attendanceEmployee.create({ data: { ...data, businessId } })
        existing ? updated++ : created++
        imported.push({ employeeId: employee.id, row })
      }
    })
    if (month && imported.some(({ row }) => row.grossIncome != null || row.netSalary != null)) {
      const run = await generatePayroll(businessId, month)
      if (!run || run.status === 'FINALIZED') throw new Error('Statul lunii selectate este finalizat și nu poate fi suprascris.')
      for (const { employeeId, row } of imported) {
        if (row.grossIncome == null && row.netSalary == null) continue
        const line = await prisma.payrollLine.findUnique({ where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId } } })
        if (!line) continue
        await prisma.payrollLine.update({ where: { id: line.id }, data: {
          baseGross: row.grossSalary || line.baseGross, grossIncome: row.grossIncome ?? line.grossIncome,
          cas: row.cas ?? line.cas, cass: row.cass ?? line.cass, incomeTax: row.incomeTax ?? line.incomeTax,
          netSalary: row.netSalary ?? line.netSalary, cam: row.cam ?? line.cam,
          employerCost: (row.grossIncome ?? line.grossIncome) + (row.cam ?? line.cam), source: 'IMPORTED_SAGA',
        } })
      }
    }
    return NextResponse.json({ ok: true, created, updated, total: records.length })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Importul SAGA a eșuat.' }, { status: 400 })
  }
}
