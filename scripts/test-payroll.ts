import assert from 'node:assert/strict'
import { calculatePayrollLine, payrollRules, workingDaysInMonth } from '../lib/payroll-calculation.ts'

assert.deepEqual(payrollRules('2026-06'), { minimumGross:4050, nonTaxableAmount:300, grossEligibilityLimit:4300, casRate:25, cassRate:10, incomeTaxRate:10, camRate:2.25 })
assert.equal(payrollRules('2026-07').minimumGross, 4325)
assert.equal(payrollRules('2026-07').nonTaxableAmount, 200)

const days = workingDaysInMonth('2026-01')
assert.ok(days >= 18 && days <= 22, `Număr neașteptat de zile lucrătoare: ${days}`)
const standard = calculatePayrollLine({ month:'2026-01', workingDays:days, workedDays:days, vacationDays:0, medicalDays:0,
  unpaidDays:0, workedHours:days*8, overtimeHours:0, baseGross:4050, dailyHours:8, employmentType:'FULL_TIME',
  baseFunction:true, personalDeduction:0 })
assert.equal(standard.nonTaxableAmount, 300)
assert.equal(standard.grossIncome, 4050)
assert.equal(standard.cas, 937.5)
assert.equal(standard.cass, 375)
assert.equal(standard.incomeTax, 243.75)
assert.equal(standard.netSalary, 2493.75)

const noRelief = calculatePayrollLine({ month:'2026-01', workingDays:days, workedDays:days, vacationDays:0, medicalDays:0,
  unpaidDays:0, workedHours:days*8, overtimeHours:0, baseGross:5000, dailyHours:8, employmentType:'FULL_TIME',
  baseFunction:true, personalDeduction:0 })
assert.equal(noRelief.nonTaxableAmount, 0)
assert.equal(noRelief.cas, 1250)

console.log('Payroll calculation tests passed.')
