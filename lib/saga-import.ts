import ExcelJS from 'exceljs'
import { XMLParser } from 'fast-xml-parser'

export type SagaImportRow = {
  row: number
  cnp: string
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  department: string
  contractNumber: string
  contractDate: string
  hiredAt: string
  iban: string
  grossSalary: number
  grossIncome: number | null
  cas: number | null
  cass: number | null
  incomeTax: number | null
  netSalary: number | null
  cam: number | null
}

const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const text = (value: unknown) => String(value ?? '').trim()
const number = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}
const nullableNumber = (value: unknown) => text(value) === '' ? null : number(value)
const date = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const raw = text(value)
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : ''
}

function find(row: Record<string, unknown>, aliases: string[]) {
  const entries = Object.entries(row)
  for (const alias of aliases) {
    const target = normalize(alias)
    const exact = entries.find(([key]) => normalize(key) === target)
    if (exact) return exact[1]
  }
  return undefined
}

function looksLikeHeader(values: unknown[]) {
  const keys = values.map(normalize)
  const hasIdentity = keys.some((key) => ['cnp','codnumericpersonal','nrcontract','numarcontract','nrcim','email'].includes(key))
  const hasPerson = keys.some((key) => ['nume','prenume','numesiprenume','salariat','angajat','fullname'].includes(key))
  return hasIdentity && hasPerson
}

function canonical(row: Record<string, unknown>, index: number): SagaImportRow {
  let lastName = text(find(row, ['nume','lastname','namefamilie','nume salariat']))
  let firstName = text(find(row, ['prenume','firstname']))
  const fullName = text(find(row, ['nume si prenume','salariat','angajat','fullname']))
  if ((!firstName || !lastName) && fullName) {
    const parts = fullName.split(/\s+/)
    lastName ||= parts.shift() || ''
    firstName ||= parts.join(' ')
  }
  return {
    row: index,
    cnp: text(find(row, ['cnp','cod numeric personal'])).replace(/\D/g, '').slice(0, 13),
    firstName, lastName,
    email: text(find(row, ['email','e-mail'])), phone: text(find(row, ['telefon','phone'])),
    position: text(find(row, ['functie','ocupatie','cor','post'])), department: text(find(row, ['departament','activitate','centru profit'])),
    contractNumber: text(find(row, ['nr contract','numar contract','contract','nrcim'])),
    contractDate: date(find(row, ['data contract','datacim'])), hiredAt: date(find(row, ['data angajarii','data angajare','inceput contract'])),
    iban: text(find(row, ['iban','cont bancar'])).replace(/\s/g, '').toUpperCase(),
    grossSalary: number(find(row, ['salariu baza','salariu de baza','salariu incadrare','brut incadrare','salariubrut'])),
    grossIncome: nullableNumber(find(row, ['venit brut','total brut','brut realizat','brut'])),
    cas: nullableNumber(find(row, ['cas','contributie cas'])), cass: nullableNumber(find(row, ['cass','contributie cass'])),
    incomeTax: nullableNumber(find(row, ['impozit','impozit salariu','impozit venit'])),
    netSalary: nullableNumber(find(row, ['net','rest de plata','rest plata','salariu net'])),
    cam: nullableNumber(find(row, ['cam','contributie asiguratorie munca'])),
  }
}

function parseDelimited(content: string) {
  const sample = content.split(/\r?\n/).slice(0, 20).join('\n')
  const delimiter = [';','\t',','].sort((a, b) => sample.split(b).length - sample.split(a).length)[0]
  const parseLine = (line: string) => {
    const cells: string[] = []; let value = ''; let quoted = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++ }
      else if (char === '"') quoted = !quoted
      else if (char === delimiter && !quoted) { cells.push(value); value = '' }
      else value += char
    }
    cells.push(value); return cells
  }
  const lines = content.split(/\r?\n/).filter((line) => line.trim())
  const headerIndex = lines.slice(0, 20).findIndex((line) => looksLikeHeader(parseLine(line)))
  const start = headerIndex >= 0 ? headerIndex : 0
  const headers = parseLine(lines[start] || '')
  return lines.slice(start + 1).map((line) => {
    const cells = parseLine(line)
    return Object.fromEntries(headers.map((header, i) => [header, cells[i] || '']))
  })
}

function xmlRecords(value: unknown, output: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) { for (const item of value) xmlRecords(item, output); return output }
  if (!value || typeof value !== 'object') return output
  const object = value as Record<string, unknown>
  const keys = Object.keys(object).map(normalize)
  if (keys.some((key) => ['cnp','codnumericpersonal'].includes(key)) && keys.some((key) => key.includes('nume'))) output.push(object)
  else for (const child of Object.values(object)) xmlRecords(child, output)
  return output
}

export async function parseSagaFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  let rows: Record<string, unknown>[] = []
  if (extension === 'xlsx') {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer() as unknown as Parameters<typeof workbook.xlsx.load>[0])
    const sheet = workbook.worksheets[0]
    if (!sheet) throw new Error('Fișierul Excel nu conține foi de calcul.')
    let headerRow = 1
    for (let index = 1; index <= Math.min(20, sheet.rowCount); index++) {
      const values = Array.from({ length: sheet.columnCount }, (_, column) => sheet.getRow(index).getCell(column + 1).text)
      if (looksLikeHeader(values)) { headerRow = index; break }
    }
    const headers = Array.from({ length: sheet.columnCount }, (_, column) => sheet.getRow(headerRow).getCell(column + 1).text.trim())
    sheet.eachRow((row, index) => {
      if (index <= headerRow) return
      rows.push(Object.fromEntries(headers.map((header, i) => {
        const cell = row.getCell(i + 1)
        return [header, cell.value instanceof Date ? cell.value : cell.text]
      })))
    })
  } else if (extension === 'xml') {
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' }).parse(await file.text())
    rows = xmlRecords(parsed)
  } else if (extension === 'csv' || extension === 'txt') {
    const bytes = await file.arrayBuffer()
    let content = new TextDecoder('utf-8').decode(bytes)
    if (content.includes('\uFFFD')) content = new TextDecoder('windows-1252').decode(bytes)
    rows = parseDelimited(content.replace(/^\uFEFF/, ''))
  } else throw new Error('Format acceptat: XLSX, CSV, TXT sau XML REGES.')
  const records = rows.map((row, index) => canonical(row, index + 2)).filter((row) => row.cnp || row.contractNumber || row.email || row.firstName || row.lastName)
  if (!records.length) throw new Error('Nu au fost identificate înregistrări de salariați în fișier.')
  return records
}
