import assert from 'node:assert/strict'
import fs from 'node:fs'
import ExcelJS from 'exceljs'
import { parseSagaFile } from '../lib/saga-import.ts'

const csv = new File([
  'Raport salariati SAGA\r\nGenerat la 24.09.2026\r\nCNP;Nume;Prenume;Nr contract;Salariu baza\r\n1960101123456;Popescu;Ana;CIM-1;4325,00',
], 'salariati.csv', { type: 'text/csv' })
const csvRows = await parseSagaFile(csv)
assert.equal(csvRows.length, 1)
assert.equal(csvRows[0].cnp, '1960101123456')
assert.equal(csvRows[0].grossSalary, 4325)

const localizedCsv = new File([
  'CNP;Nume;Prenume;Nr contract;Salariu baza;Venit brut;CAS\r\n1960101123456;Popescu;Ana;CIM-1;4.325,00;5.000,50;1.250,13',
], 'salarii-localizate.csv', { type: 'text/csv' })
const localizedRows = await parseSagaFile(localizedCsv)
assert.equal(localizedRows[0].grossSalary, 4325)
assert.equal(localizedRows[0].grossIncome, 5000.5)
assert.equal(localizedRows[0].cas, 1250.13)

const invalidCsv = new File([
  'CNP;Nume;Prenume;Nr contract;Salariu baza\r\n1960101123456;Popescu;Ana;CIM-1;4.3x5,00',
], 'salarii-invalide.csv', { type: 'text/csv' })
await assert.rejects(() => parseSagaFile(invalidCsv), /nu este o sumă validă/)

const invalidDateCsv = new File([
  'CNP;Nume;Prenume;Nr contract;Data angajarii;Salariu baza\r\n1960101123456;Popescu;Ana;CIM-1;31.02.2026;4325,00',
], 'salarii-data-invalida.csv', { type: 'text/csv' })
await assert.rejects(() => parseSagaFile(invalidDateCsv), /data angajării.*nu este o dată calendaristică validă/)

const deductionOnlyCsv = new File([
  'CNP;Nume;Prenume;Nr contract;Data angajarii;CAS;CASS;Impozit;CAM\r\n1960101123456;Popescu;Ana;CIM-1;01.01.2024;1.000,00;400,00;250,00;90,00',
], 'salarii-contributii.csv', { type: 'text/csv' })
const deductionRows = await parseSagaFile(deductionOnlyCsv)
assert.equal(deductionRows[0].grossIncome, null)
assert.equal(deductionRows[0].netSalary, null)
assert.equal(deductionRows[0].cas, 1000)
assert.equal(deductionRows[0].cam, 90)

const workbook = new ExcelJS.Workbook()
const sheet = workbook.addWorksheet('Salariati')
sheet.addRow(['Raport REGES'])
sheet.addRow(['CNP', 'Nume si prenume', 'Contract', 'Brut incadrare'])
sheet.addRow(['1960101123456', 'POPESCU ANA', 'CIM-1', 4325])
const bytes = await workbook.xlsx.writeBuffer()
const xlsx = new File([bytes as ArrayBuffer], 'salariati.xlsx')
const xlsxRows = await parseSagaFile(xlsx)
assert.equal(xlsxRows.length, 1)
assert.equal(xlsxRows[0].lastName, 'POPESCU')
assert.equal(xlsxRows[0].firstName, 'ANA')
assert.equal(xlsxRows[0].contractNumber, 'CIM-1')

const sagaRouteSource = fs.readFileSync('app/api/payroll/saga-import/route.ts', 'utf8')
assert.match(sagaRouteSource, /generatePayrollInTransaction\(tx, businessId, month\)/)
assert.match(sagaRouteSource, /function hasPayrollValues/)
assert.doesNotMatch(sagaRouteSource, /existing\?\.hiredAt \|\| new Date\(\)/,
  'A missing hire date must not silently become today')
assert.doesNotMatch(sagaRouteSource, /if \(!line\) continue/,
  'Payroll rows without an eligible payroll line must fail instead of being silently dropped')
assert.doesNotMatch(sagaRouteSource, /await prisma\.payrollLine\.(findUnique|update)/,
  'SAGA employees and payroll lines must remain in the same database transaction')

console.log('SAGA import parser tests passed.')
