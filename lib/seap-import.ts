import { unzipSync } from 'fflate'
import { XMLParser } from 'fast-xml-parser'

export type SeapRow = {
  noticeNumber: string
  title: string
  publicationDate: string | null
  deadline: string
  estimatedValue: number | null
  currency: 'RON' | 'EUR'
  contractingAuthority: string | null
  procedureType: string | null
  cpvCode: string | null
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, parseTagValue: false, trimValues: false })
const list = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value]
const text = (value: unknown): string => value == null ? '' : typeof value === 'object' && value !== null && '#text' in value ? String((value as { '#text': unknown })['#text']) : String(value)
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function parseCsv(source: string): string[][] {
  const firstLine = source.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0]
  const delimiter = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0]
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted
    } else if (char === delimiter && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(cell); if (row.some(value => value.trim())) rows.push(row)
      row = []; cell = ''
    } else cell += char
  }
  row.push(cell); if (row.some(value => value.trim())) rows.push(row)
  return rows
}

function parseXlsx(bytes: Uint8Array): string[][] {
  let expanded = 0
  const files = unzipSync(bytes, { filter: file => {
    if (!/^xl\/(worksheets\/[^/]+\.xml|sharedStrings\.xml)$/.test(file.name)) return false
    expanded += file.originalSize
    if (expanded > 20 * 1024 * 1024) throw new Error('Fișierul Excel este prea mare pentru import.')
    return true
  } })
  const sheetPath = Object.keys(files).filter(name => /^xl\/worksheets\/[^/]+\.xml$/.test(name)).sort()[0]
  if (!sheetPath) throw new Error('Fișierul Excel nu conține o foaie de calcul.')
  const sharedFile = files['xl/sharedStrings.xml']
  const shared = sharedFile ? list<any>(xml.parse(new TextDecoder().decode(sharedFile)).sst?.si).map(item => text(item.t ?? list<any>(item.r).map(run => text(run.t)).join(''))) : []
  const sheet = xml.parse(new TextDecoder().decode(files[sheetPath])).worksheet
  const rows: string[][] = []
  for (const entry of list<any>(sheet?.sheetData?.row)) {
    const row: string[] = []
    for (const cell of list<any>(entry.c)) {
      const ref = String(cell.r || '')
      const letters = ref.match(/^[A-Z]+/)?.[0]
      if (!letters) continue
      let col = 0
      for (const letter of letters) col = col * 26 + letter.charCodeAt(0) - 64
      if (col > 100) continue
      const raw = cell.t === 'inlineStr' ? text(cell.is?.t ?? list<any>(cell.is?.r).map((run: any) => text(run.t)).join('')) : cell.t === 's' ? shared[Number(cell.v)] || '' : text(cell.v)
      row[col - 1] = raw
    }
    if (row.some(value => value?.trim())) rows.push(row)
    if (rows.length > 5000) throw new Error('Fișierul conține prea multe anunțuri (maximum 5.000).')
  }
  return rows
}

function parseDate(value: string, withTime: boolean): string | null {
  const v = value.trim()
  const ro = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (ro) {
    const [, d, m, y, h = '00', min = '00'] = ro
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    return withTime ? `${iso}T${h.padStart(2, '0')}:${min}` : iso
  }
  const iso = v.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/)
  if (iso) return withTime ? `${iso[1]}T${iso[2] || '00:00'}` : iso[1]
  const serial = Number(v)
  if (serial > 20000 && serial < 100000) {
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
    const day = date.toISOString().slice(0, 10)
    return withTime ? `${day}T${date.toISOString().slice(11, 16)}` : day
  }
  return null
}

function parseMoney(value: string): { amount: number | null; currency: 'RON' | 'EUR' } {
  const currency = /\bEUR\b/i.test(value) ? 'EUR' : 'RON'
  const raw = value.replace(/[^\d.,-]/g, '')
  if (!raw) return { amount: null, currency }
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const amount = Number(normalized)
  return { amount: Number.isFinite(amount) && amount >= 0 ? amount : null, currency }
}

export function parseSeapExport(fileName: string, bytes: Uint8Array): { rows: SeapRow[]; invalid: number } {
  const lower = fileName.toLowerCase()
  let table: string[][]
  if (lower.endsWith('.xlsx')) table = parseXlsx(bytes)
  else if (lower.endsWith('.csv')) {
    let source = new TextDecoder('utf-8').decode(bytes)
    if (source.includes('\uFFFD')) source = new TextDecoder('windows-1250').decode(bytes)
    table = parseCsv(source)
  } else throw new Error('Alege un fișier Excel (.xlsx) sau CSV exportat din SEAP.')
  if (table.length < 2) throw new Error('Fișierul nu conține anunțuri.')
  const headers = table[0].map(value => normalize(value || ''))
  const column = (name: string) => headers.findIndex(value => value.includes(name))
  const positions = {
    number: column('numar anunt'), title: column('denumire contract'), deadline: column('data limita depunere'),
    publication: column('data publicare'), amount: column('valoare estimata'), authority: column('autoritate contractanta'),
    procedure: column('tip procedura'), cpv: column('cod cpv'),
  }
  if (positions.number < 0 || positions.title < 0 || positions.deadline < 0) throw new Error('Nu recunosc coloanele SEAP: număr anunț, denumire contract și data limită de depunere.')
  const rows: SeapRow[] = []
  let invalid = 0
  for (const cells of table.slice(1, 5001)) {
    const get = (index: number) => index < 0 ? '' : String(cells[index] || '').trim()
    const noticeNumber = get(positions.number).toUpperCase()
    const title = get(positions.title)
    const deadline = parseDate(get(positions.deadline), true)
    if (!noticeNumber || !title || !deadline || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline) || Number.isNaN(new Date(deadline).getTime())) { invalid++; continue }
    const money = parseMoney(get(positions.amount))
    rows.push({ noticeNumber: noticeNumber.slice(0, 80), title: title.slice(0, 300), deadline,
      publicationDate: parseDate(get(positions.publication), false), estimatedValue: money.amount, currency: money.currency,
      contractingAuthority: get(positions.authority).slice(0, 250) || null,
      procedureType: get(positions.procedure).slice(0, 120) || null,
      cpvCode: get(positions.cpv).slice(0, 120) || null })
  }
  return { rows, invalid }
}
