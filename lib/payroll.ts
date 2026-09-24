import { prisma } from './prisma'
import { ensurePayrollSchema } from './payroll-storage'
import { postPayrollToLedger } from './accounting/ledger'
import { calculatePayrollLine, isPayrollWorkingDay, payrollRules, workingDaysForEmployment, workingDaysInMonth } from './payroll-calculation'

export { calculatePayrollLine, payrollRules, workingDaysForEmployment, workingDaysInMonth }

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export async function generatePayroll(businessId: string, month: string) {
  await ensurePayrollSchema()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Luna nu este validă.')
  const [year, number] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, number - 1, 1))
  const end = new Date(Date.UTC(year, number, 1))
  const rules = payrollRules(month)
  const run = await prisma.payrollRun.upsert({
    where: { businessId_month: { businessId, month } },
    create: { businessId, month, minimumGross: rules.minimumGross, nonTaxableAmount: rules.nonTaxableAmount,
      casRate: rules.casRate, cassRate: rules.cassRate, incomeTaxRate: rules.incomeTaxRate, camRate: rules.camRate },
    update: {},
  })
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status::text FROM "PayrollRun" WHERE id=${run.id} FOR UPDATE`
    if (locked[0]?.status === 'FINALIZED') throw new Error('Statul finalizat nu mai poate fi recalculat.')
    const [employees, attendance, existing] = await Promise.all([
      tx.attendanceEmployee.findMany({ where: {
        businessId, hiredAt: { lt: end },
        OR: [{ active: true, endedAt: null }, { endedAt: { gte: start } }],
      } }),
      tx.dailyAttendance.findMany({ where: { businessId, workDate: { gte: start, lt: end } } }),
      tx.payrollLine.findMany({ where: { payrollRunId: run.id } }),
    ])
    const old = new Map(existing.map((line) => [line.employeeId, line]))
    const eligibleIds = employees.map((employee) => employee.id)
    await tx.payrollLine.deleteMany({
      where: { payrollRunId: run.id, ...(eligibleIds.length ? { employeeId: { notIn: eligibleIds } } : {}) },
    })
    const workingDays = workingDaysInMonth(month)
    for (const employee of employees) {
    const hiredDay = new Date(Date.UTC(employee.hiredAt.getUTCFullYear(), employee.hiredAt.getUTCMonth(), employee.hiredAt.getUTCDate()))
    const endedDay = employee.endedAt
      ? new Date(Date.UTC(employee.endedAt.getUTCFullYear(), employee.endedAt.getUTCMonth(), employee.endedAt.getUTCDate()))
      : null
    const rows = attendance.filter((row) => row.employeeId === employee.id && row.workDate >= hiredDay &&
      (!endedDay || row.workDate <= endedDay))
    const normalRows = rows.filter((row) => isPayrollWorkingDay(row.workDate))
    const workedDays = normalRows.filter((row) => ['PRESENT','REMOTE'].includes(row.status)).length
    const vacationDays = normalRows.filter((row) => ['VACATION','DAY_OFF'].includes(row.status)).length
    const medicalDays = normalRows.filter((row) => row.status === 'MEDICAL').length
    const unpaidDays = normalRows.filter((row) => row.status === 'ABSENT').length
    const workedHours = round(rows.filter((row) => ['PRESENT','REMOTE'].includes(row.status)).reduce((sum, row) => sum + row.hours, 0))
    const overtimeHours = round(rows.filter((row) => ['PRESENT','REMOTE'].includes(row.status)).reduce((sum, row) =>
      sum + (isPayrollWorkingDay(row.workDate) ? Math.max(0, row.hours - employee.dailyHours) : row.hours), 0))
    const previous = old.get(employee.id)
    const calculated = calculatePayrollLine({ month, workingDays, workedDays, vacationDays, medicalDays, unpaidDays,
      workedHours, overtimeHours, baseGross: employee.grossSalary, dailyHours: employee.dailyHours,
      employmentType: employee.employmentType, baseFunction: employee.baseFunction, personalDeduction: employee.personalDeduction,
      bonuses: previous?.bonuses, medicalAllowance: previous?.medicalAllowance, taxableBenefits: previous?.taxableBenefits,
      mealTickets: previous?.mealTickets, otherDeductions: previous?.otherDeductions, advancePaid: previous?.advancePaid,
      overtimeAmount: previous?.source.startsWith('IMPORTED_SAGA') ? previous.overtimeAmount : undefined })
    const financialValues = previous?.source.startsWith('IMPORTED_SAGA') ? {
      attendanceGross: previous.attendanceGross, overtimeAmount: previous.overtimeAmount,
      bonuses: previous.bonuses, medicalAllowance: previous.medicalAllowance,
      taxableBenefits: previous.taxableBenefits, mealTickets: previous.mealTickets,
      nonTaxableAmount: previous.nonTaxableAmount, grossIncome: previous.grossIncome,
      cas: previous.cas, cass: previous.cass, personalDeduction: previous.personalDeduction,
      taxableBase: previous.taxableBase, incomeTax: previous.incomeTax,
      otherDeductions: previous.otherDeductions, advancePaid: previous.advancePaid,
      netSalary: previous.netSalary, cam: previous.cam, employerCost: previous.employerCost,
    } : calculated
      await tx.payrollLine.upsert({
      where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: employee.id } },
      create: { payrollRunId: run.id, employeeId: employee.id, workingDays, workedDays, vacationDays, medicalDays,
        unpaidDays, workedHours, overtimeHours, baseGross: employee.grossSalary, ...calculated },
      update: { workingDays, workedDays, vacationDays, medicalDays, unpaidDays, workedHours, overtimeHours,
        baseGross: employee.grossSalary, ...financialValues, source: previous?.source || 'CALCULATED' },
      })
    }
  })
  return getPayroll(businessId, month)
}

export async function getPayroll(businessId: string, month: string) {
  await ensurePayrollSchema()
  return prisma.payrollRun.findUnique({
    where: { businessId_month: { businessId, month } },
    include: { lines: { include: { employee: true }, orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }] } },
  })
}

export async function updatePayrollLine(businessId: string, lineId: string, values: {
  bonuses?: number; medicalAllowance?: number; taxableBenefits?: number; mealTickets?: number;
  otherDeductions?: number; advancePaid?: number; overtimeAmount?: number; notes?: string;
}) {
  await ensurePayrollSchema()
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT pr.status::text
      FROM "PayrollRun" pr JOIN "PayrollLine" pl ON pl."payrollRunId"=pr.id
      WHERE pl.id=${lineId} AND pr."businessId"=${businessId}
      FOR UPDATE OF pr`
    if (locked[0]?.status !== 'DRAFT') throw new Error('Poziția nu există sau statul este finalizat.')
    const line = await tx.payrollLine.findUnique({ where: { id: lineId }, include: { payrollRun: true, employee: true } })
    if (!line) throw new Error('Poziția nu există sau statul este finalizat.')
    const calculated = calculatePayrollLine({
      month: line.payrollRun.month, workingDays: line.workingDays, workedDays: line.workedDays,
      vacationDays: line.vacationDays, medicalDays: line.medicalDays, unpaidDays: line.unpaidDays,
      workedHours: line.workedHours, overtimeHours: line.overtimeHours, baseGross: line.baseGross,
      dailyHours: line.employee.dailyHours, employmentType: line.employee.employmentType,
      baseFunction: line.employee.baseFunction, personalDeduction: line.employee.personalDeduction,
      bonuses: values.bonuses ?? line.bonuses, medicalAllowance: values.medicalAllowance ?? line.medicalAllowance,
      taxableBenefits: values.taxableBenefits ?? line.taxableBenefits, mealTickets: values.mealTickets ?? line.mealTickets,
      otherDeductions: values.otherDeductions ?? line.otherDeductions, advancePaid: values.advancePaid ?? line.advancePaid,
      overtimeAmount: values.overtimeAmount ?? line.overtimeAmount,
    })
    return tx.payrollLine.update({ where: { id: line.id }, data: { ...calculated, notes: values.notes ?? line.notes,
      source: line.source.startsWith('IMPORTED_SAGA') ? 'IMPORTED_SAGA_EDITED' : 'MANUAL' } })
  })
}

export async function finalizePayroll(businessId: string, month: string, finalizedBy: string) {
  const run = await getPayroll(businessId, month)
  if (!run) throw new Error('Generează mai întâi statul de salarii.')
  if (run.status === 'FINALIZED') return run
  if (!run.lines.length) throw new Error('Statul nu conține angajați.')
  const missingSalary = run.lines.filter((line) => line.baseGross <= 0).map((line) => `${line.employee.lastName} ${line.employee.firstName}`)
  if (missingSalary.length) throw new Error(`Completează salariul brut pentru: ${missingSalary.join(', ')}.`)
  const missingMedicalAllowance = run.lines.filter((line) => line.medicalDays > 0 && line.medicalAllowance <= 0)
    .map((line) => `${line.employee.lastName} ${line.employee.firstName}`)
  if (missingMedicalAllowance.length) throw new Error(`Completează indemnizația pentru concediul medical: ${missingMedicalAllowance.join(', ')}.`)
  const incompleteAttendance = run.lines.filter((line) => !line.source.startsWith('IMPORTED_SAGA') &&
    line.workedDays + line.vacationDays + line.medicalDays + line.unpaidDays + 0.01 < workingDaysForEmployment(month, line.employee.hiredAt, line.employee.endedAt))
    .map((line) => `${line.employee.lastName} ${line.employee.firstName}`)
  if (incompleteAttendance.length) throw new Error(`Pontaj incomplet pentru: ${incompleteAttendance.join(', ')}.`)
  const inconsistentNet = run.lines.filter((line) => {
    const expected = round(line.grossIncome - line.cas - line.cass - line.incomeTax - line.otherDeductions - line.advancePaid)
    return line.netSalary < -0.009 || Math.abs(expected - line.netSalary) > 0.02
  }).map((line) => `${line.employee.lastName} ${line.employee.firstName}`)
  if (inconsistentNet.length) throw new Error(`Net invalid sau import SAGA incomplet pentru: ${inconsistentNet.join(', ')}.`)
  const totals = run.lines.reduce((sum, line) => ({
    gross: sum.gross + line.grossIncome,
    cas: sum.cas + line.cas,
    cass: sum.cass + line.cass,
    incomeTax: sum.incomeTax + line.incomeTax,
    cam: sum.cam + line.cam,
    otherDeductions: sum.otherDeductions + line.otherDeductions,
    advancePaid: sum.advancePaid + line.advancePaid,
  }), { gross: 0, cas: 0, cass: 0, incomeTax: 0, cam: 0, otherDeductions: 0, advancePaid: 0 })
  if (totals.gross <= 0) throw new Error('Statul nu are venituri salariale de contabilizat. Verifică pontajele.')
  await postPayrollToLedger({ runId: run.id, month, ...totals, createdBy: finalizedBy })
  return getPayroll(businessId, month)
}
