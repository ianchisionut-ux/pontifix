const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function payrollRules(month: string) {
  if (!/^202[56]-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Calculul salarial este configurat fiscal doar pentru anii 2025–2026. Actualizează regulile fiscale înainte de a lucra în altă perioadă.')
  }
  if (month.startsWith('2025-')) return {
    minimumGross: 4050,
    nonTaxableAmount: 300,
    grossEligibilityLimit: 4300,
    casRate: 25,
    cassRate: 10,
    incomeTaxRate: 10,
    camRate: 2.25,
  }
  const secondHalf = month >= '2026-07'
  return {
    minimumGross: secondHalf ? 4325 : 4050,
    nonTaxableAmount: secondHalf ? 200 : 300,
    grossEligibilityLimit: secondHalf ? 4600 : 4300,
    casRate: 25,
    cassRate: 10,
    incomeTaxRate: 10,
    camRate: 2.25,
  }
}

function orthodoxEaster(year: number) {
  const a = year % 4, b = year % 7, c = year % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const julianMonth = Math.floor((d + e + 114) / 31)
  const julianDay = ((d + e + 114) % 31) + 1
  return new Date(Date.UTC(year, julianMonth - 1, julianDay + 13))
}

function holidaySet(year: number) {
  const fixed = ['01-01','01-02','01-06','01-07','01-24','05-01','06-01','06-24','08-15','11-30','12-01','12-25','12-26']
  const result = new Set(fixed.map((day) => `${year}-${day}`))
  const easter = orthodoxEaster(year)
  for (const offset of [-2, 1, 50]) {
    const date = new Date(easter)
    date.setUTCDate(date.getUTCDate() + offset)
    result.add(date.toISOString().slice(0, 10))
  }
  return result
}

export function workingDaysInMonth(month: string) {
  const [year, number] = month.split('-').map(Number)
  const holidays = holidaySet(year)
  let count = 0
  for (let day = new Date(Date.UTC(year, number - 1, 1)); day.getUTCMonth() === number - 1; day.setUTCDate(day.getUTCDate() + 1)) {
    const weekday = day.getUTCDay()
    if (weekday !== 0 && weekday !== 6 && !holidays.has(day.toISOString().slice(0, 10))) count++
  }
  return count
}

export function workingDaysForEmployment(month: string, hiredAt: Date | string) {
  const [year, number] = month.split('-').map(Number)
  const monthStart = new Date(Date.UTC(year, number - 1, 1))
  const monthEnd = new Date(Date.UTC(year, number, 1))
  const hired = new Date(hiredAt)
  const firstDay = hired > monthStart ? new Date(Date.UTC(hired.getUTCFullYear(), hired.getUTCMonth(), hired.getUTCDate())) : monthStart
  if (firstDay >= monthEnd) return 0
  const holidays = holidaySet(year)
  let count = 0
  for (const day = new Date(firstDay); day < monthEnd; day.setUTCDate(day.getUTCDate() + 1)) {
    const weekday = day.getUTCDay()
    if (weekday !== 0 && weekday !== 6 && !holidays.has(day.toISOString().slice(0, 10))) count++
  }
  return count
}

type CalculationInput = {
  month: string
  workingDays: number
  workedDays: number
  vacationDays: number
  medicalDays: number
  unpaidDays: number
  workedHours: number
  overtimeHours: number
  baseGross: number
  dailyHours: number
  employmentType: string
  baseFunction: boolean
  personalDeduction: number
  bonuses?: number
  medicalAllowance?: number
  taxableBenefits?: number
  mealTickets?: number
  otherDeductions?: number
  advancePaid?: number
  overtimeAmount?: number
}

export function calculatePayrollLine(input: CalculationInput) {
  const rules = payrollRules(input.month)
  const paidNormalDays = Math.min(input.workingDays, input.workedDays + input.vacationDays)
  const attendanceGross = round(input.workingDays ? input.baseGross * paidNormalDays / input.workingDays : 0)
  const monthlyHours = Math.max(1, input.workingDays * input.dailyHours)
  const overtimeAmount = round(input.overtimeAmount ?? input.overtimeHours * input.baseGross / monthlyHours * 1.75)
  const bonuses = round(input.bonuses || 0)
  const medicalAllowance = round(input.medicalAllowance || 0)
  const taxableBenefits = round(input.taxableBenefits || 0)
  const mealTickets = round(input.mealTickets || 0)
  const grossIncome = round(attendanceGross + overtimeAmount + bonuses + medicalAllowance)
  const eligibleRelief = input.employmentType === 'FULL_TIME' && input.baseFunction &&
    Math.abs(input.baseGross - rules.minimumGross) < 0.01 && grossIncome + taxableBenefits <= rules.grossEligibilityLimit
  const nonTaxableAmount = eligibleRelief
    ? round(rules.nonTaxableAmount * Math.min(1, paidNormalDays / Math.max(1, input.workingDays)))
    : 0
  const socialBase = Math.max(0, round(grossIncome + taxableBenefits - nonTaxableAmount))
  const cas = round(socialBase * rules.casRate / 100)
  const cass = round((socialBase + mealTickets) * rules.cassRate / 100)
  const personalDeduction = input.baseFunction ? Math.max(0, round(input.personalDeduction || 0)) : 0
  const taxableBase = Math.max(0, round(grossIncome + taxableBenefits + mealTickets - nonTaxableAmount - cas - cass - personalDeduction))
  const incomeTax = round(taxableBase * rules.incomeTaxRate / 100)
  const otherDeductions = round(input.otherDeductions || 0)
  const advancePaid = round(input.advancePaid || 0)
  const netSalary = round(grossIncome + taxableBenefits - cas - cass - incomeTax - otherDeductions - advancePaid)
  const cam = round(socialBase * rules.camRate / 100)
  return { attendanceGross, overtimeAmount, bonuses, medicalAllowance, taxableBenefits, mealTickets,
    nonTaxableAmount, grossIncome, cas, cass, personalDeduction, taxableBase, incomeTax,
    otherDeductions, advancePaid, netSalary, cam, employerCost: round(grossIncome + taxableBenefits + cam) }
}
