import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { parseSagaFile } from '../lib/saga-import.ts'

const csv = new File([
  'Raport salariati SAGA\r\nGenerat la 24.09.2026\r\nCNP;Nume;Prenume;Nr contract;Salariu baza\r\n1960101123456;Popescu;Ana;CIM-1;4325,00',
], 'salariati.csv', { type: 'text/csv' })
const csvRows = await parseSagaFile(csv)
assert.equal(csvRows.length, 1)
assert.equal(csvRows[0].cnp, '1960101123456')
assert.equal(csvRows[0].grossSalary, 4325)

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

console.log('SAGA import parser tests passed.')
