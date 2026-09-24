import { prisma } from './prisma'
import { ensurePayrollSchema } from './payroll-storage'
import { postPayrollToLedger } from './accounting/ledger'
import { calculatePayrollLine, payrollRules, workingDaysInMonth } from './payroll-calculation'

export { calculatePayrollLine, payrollRules, workingDaysInMonth }

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
  if (run.status === 'FINALIZED') throw new Error('Statul finalizat nu mai poate fi recalculat.')
  const [employees, attendance, existing] = await Promise.all([
    prisma.attendanceEmployee.findMany({ where: { businessId, active: true, hiredAt: { lt: end } } }),
    prisma.dailyAttendance.findMany({ where: { businessId, workDate: { gte: start, lt: end } } }),
    prisma.payrollLine.findMany({ where: { payrollRunId: run.id } }),
  ])
  const old = new Map(existing.map((line) => [line.employeeId, line]))
  const workingDays = workingDaysInMonth(month)
  for (const employee of employees) {
    const rows = attendance.filter((row) => row.employeeId === employee.id)
    const workedDays = rows.filter((row) => ['PRESENT','REMOTE'].includes(row.status)).length
    const vacationDays = rows.filter((row) => ['VACATION','DAY_OFF'].includes(row.status)).length
    const medicalDays = rows.filter((row) => row.status === 'MEDICAL').length
    const unpaidDays = rows.filter((row) => row.status === 'ABSENT').length
    const workedHours = round(rows.filter((row) => ['PRESENT','REMOTE'].includes(row.status)).reduce((sum, row) => sum + row.hours, 0))
    const overtimeHours = round(rows.filter((row) => ['PRESENT','REMOTE'].includes(row.status)).reduce((sum, row) => sum + Math.max(0, row.hours - employee.dailyHours), 0))
    const previous = old.get(employee.id)
    const calculated = calculatePayrollLine({ month, workingDays, workedDays, vacationDays, medicalDays, unpaidDays,
      workedHours, overtimeHours, baseGross: employee.grossSalary, dailyHours: employee.dailyHours,
      employmentType: employee.employmentType, baseFunction: employee.baseFunction, personalDeduction: employee.personalDeduction,
      bonuses: previous?.bonuses, medicalAllowance: previous?.medicalAllowance, taxableBenefits: previous?.taxableBenefits,
      mealTickets: previous?.mealTickets, otherDeductions: previous?.otherDeductions, advancePaid: previous?.advancePaid,
      overtimeAmount: previous?.source === 'IMPORTED_SAGA' ? previous.overtimeAmount : undefined })
    const financialValues = previous?.source === 'IMPORTED_SAGA' ? {
      attendanceGross: previous.attendanceGross, overtimeAmount: previous.overtimeAmount,
      bonuses: previous.bonuses, medicalAllowance: previous.medicalAllowance,
      taxableBenefits: previous.taxableBenefits, mealTickets: previous.mealTickets,
      nonTaxableAmount: previous.nonTaxableAmount, grossIncome: previous.grossIncome,
      cas: previous.cas, cass: previous.cass, personalDeduction: previous.personalDeduction,
      taxableBase: previous.taxableBase, incomeTax: previous.incomeTax,
      otherDeductions: previous.otherDeductions, advancePaid: previous.advancePaid,
      netSalary: previous.netSalary, cam: previous.cam, employerCost: previous.employerCost,
    } : calculated
    await prisma.payrollLine.upsert({
      where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: employee.id } },
      create: { payrollRunId: run.id, employeeId: employee.id, workingDays, workedDays, vacationDays, medicalDays,
        unpaidDays, workedHours, overtimeHours, baseGross: employee.grossSalary, ...calculated },
      update: { workingDays, workedDays, vacationDays, medicalDays, unpaidDays, workedHours, overtimeHours,
        baseGross: employee.grossSalary, ...financialValues, source: previous?.source || 'CALCULATED' },
    })
  }
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
  const line = await prisma.payrollLine.findFirst({
    where: { id: lineId, payrollRun: { businessId, status: 'DRAFT' } },
    include: { payrollRun: true, employee: true },
  })
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
  return prisma.payrollLine.update({ where: { id: line.id }, data: { ...calculated, notes: values.notes ?? line.notes, source: 'MANUAL' } })
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
  const totals = run.lines.reduce((sum, line) => ({
    gross: sum.gross + line.grossIncome + line.taxableBenefits,
    cas: sum.cas + line.cas,
    cass: sum.cass + line.cass,
    incomeTax: sum.incomeTax + line.incomeTax,
    cam: sum.cam + line.cam,
    otherDeductions: sum.otherDeductions + line.otherDeductions,
    advancePaid: sum.advancePaid + line.advancePaid,
  }), { gross: 0, cas: 0, cass: 0, incomeTax: 0, cam: 0, otherDeductions: 0, advancePaid: 0 })
  if (totals.gross <= 0) throw new Error('Statul nu are venituri salariale de contabilizat. Verifică pontajele.')
  await postPayrollToLedger({ runId: run.id, month, ...totals, createdBy: finalizedBy })
  return prisma.payrollRun.update({ where: { id: run.id }, data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedBy } })
}
