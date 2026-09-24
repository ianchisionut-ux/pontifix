import assert from 'node:assert/strict'
import { calculatePayrollLine, isPayrollWorkingDay, payrollRules, workingDaysForEmployment, workingDaysInMonth } from '../lib/payroll-calculation.ts'

assert.deepEqual(payrollRules('2026-06'), { minimumGross:4050, nonTaxableAmount:300, grossEligibilityLimit:4300, casRate:25, cassRate:10, incomeTaxRate:10, camRate:2.25 })
assert.equal(payrollRules('2026-07').minimumGross, 4325)
assert.equal(payrollRules('2026-07').nonTaxableAmount, 200)
assert.equal(payrollRules('2025-12').nonTaxableAmount, 300)
assert.throws(() => payrollRules('2027-01'), /2025–2026/)

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

const hiredMidMonth = workingDaysForEmployment('2026-01', '2026-01-15')
assert.ok(hiredMidMonth > 0 && hiredMidMonth < days)
const endedMidMonth = workingDaysForEmployment('2026-01', '2020-01-01', '2026-01-15')
assert.ok(endedMidMonth > 0 && endedMidMonth < days)
assert.equal(workingDaysForEmployment('2026-01', '2026-02-01'), 0)
assert.equal(workingDaysForEmployment('2026-01', '2020-01-01', '2025-12-31'), 0)
assert.equal(isPayrollWorkingDay('2026-01-03'), false)

const benefitsRemoveRelief = calculatePayrollLine({ month:'2026-01', workingDays:days, workedDays:days, vacationDays:0, medicalDays:0,
  unpaidDays:0, workedHours:days*8, overtimeHours:0, baseGross:4050, dailyHours:8, employmentType:'FULL_TIME',
  baseFunction:true, personalDeduction:0, taxableBenefits:300 })
assert.equal(benefitsRemoveRelief.nonTaxableAmount, 0)
assert.equal(benefitsRemoveRelief.netSalary, benefitsRemoveRelief.grossIncome - benefitsRemoveRelief.cas - benefitsRemoveRelief.cass - benefitsRemoveRelief.incomeTax)

console.log('Payroll calculation tests passed.')
