import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { chromium } from 'playwright-core'

const PORTAL_URL = 'https://avize.distributie-energie.ro/solicitare'
const FIXED_EMAIL = 'elmont_zalau@yahoo.com'
const CAPTCHA_WAIT_MS = 15 * 60 * 1000

function argumentValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function extractDossierNumber(value = '') {
  const exact = String(value).match(/(?<!\d)\d{13}(?!\d)/)?.[0]
  if (!exact) throw new Error('Numărul ATR trebuie să conțină exact 13 cifre. Data nu se include.')
  return exact
}

async function loadJob(configPath) {
  const absoluteConfigPath = path.resolve(configPath)
  const raw = JSON.parse(await readFile(absoluteConfigPath, 'utf8'))
  for (const key of ['applicant', 'locality', 'street']) {
    if (!String(raw[key] || '').trim()) throw new Error(`Câmp obligatoriu lipsă în configurare: ${key}`)
  }

  const pdfDirectory = path.resolve(path.dirname(absoluteConfigPath), raw.pdfDirectory || '.')
  const documents = Array.isArray(raw.documents) ? raw.documents.map((entry, index) => {
    const document = typeof entry === 'string' ? { file: entry } : entry
    if (!document?.file) throw new Error(`Lipsește numele fișierului pentru documentul ${document?.label || index + 1}.`)
    const file = path.resolve(pdfDirectory, document.file)
    if (path.extname(file).toLowerCase() !== '.pdf') throw new Error(`Este acceptat numai PDF: ${file}`)
    return { label: String(document.label || ''), file, fieldIndex: document.fieldIndex }
  }) : []

  for (const document of documents) await access(document.file)

  return {
    dossierNumber: extractDossierNumber(raw.dossierNumber),
    applicant: String(raw.applicant).trim(),
    locality: String(raw.locality).trim(),
    street: String(raw.street).trim(),
    action: String(raw.action || 'completareDocumentatie'),
    actionLabel: String(raw.actionLabel || 'Completare documentație'),
    documents,
  }
}

async function firstVisible(locator) {
  for (let index = 0; index < await locator.count(); index += 1) {
    const candidate = locator.nth(index)
    if (await candidate.isVisible().catch(() => false)) return candidate
  }
  return null
}

async function fillField(page, label, value, fallbackIndex) {
  const pattern = new RegExp(label, 'i')
  const candidates = [
    page.getByLabel(pattern),
    page.locator('label').filter({ hasText: pattern }).locator('input, textarea'),
    page.locator(`input[placeholder*="${label}" i]`),
  ]
  for (const locator of candidates) {
    const input = await firstVisible(locator)
    if (input) {
      await input.fill(value)
      return
    }
  }

  const fallback = page.locator('input:not([type="hidden"]):not([type="file"]), textarea').nth(fallbackIndex)
  if (!(await fallback.isVisible().catch(() => false))) throw new Error(`Nu am găsit câmpul „${label}”. Portalul DEER și-a schimbat formularul.`)
  await fallback.fill(value)
}

async function selectAction(page, job) {
  const select = await firstVisible(page.getByLabel(/Acțiune/i)) || await firstVisible(page.locator('select'))
  if (!select) throw new Error('Nu am găsit lista „Acțiune”.')
  try {
    await select.selectOption(job.action)
  } catch {
    await select.selectOption({ label: job.actionLabel })
  }
}

async function describeFileInputs(page) {
  return page.locator('input[type="file"]').evaluateAll((inputs) => inputs.map((input, index) => {
    const byFor = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.textContent : ''
    const wrappingLabel = input.closest('label')?.textContent || ''
    const parentText = input.parentElement?.parentElement?.textContent || input.parentElement?.textContent || ''
    return {
      index,
      multiple: input.multiple,
      description: [input.getAttribute('aria-label'), input.name, byFor, wrappingLabel, parentText]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500),
    }
  }))
}

function matchScore(label, description) {
  const left = normalize(label)
  const right = normalize(description)
  if (!left) return 0
  if (right.includes(left)) return 1000 + left.length
  return left.split(' ').filter((word) => word.length > 2).reduce((score, word) => score + (right.includes(word) ? word.length : 0), 0)
}

async function uploadDocuments(page, documents) {
  if (!documents.length) {
    console.log('Nu sunt PDF-uri configurate; browserul rămâne la etapa de încărcare.')
    return
  }

  const metadata = await describeFileInputs(page)
  if (!metadata.length) throw new Error('Etapa următoare nu conține câmpuri pentru fișiere PDF.')
  const inputs = page.locator('input[type="file"]')

  if (metadata.length === 1 && metadata[0].multiple) {
    await inputs.first().setInputFiles(documents.map((document) => document.file))
    console.log(`Au fost atașate ${documents.length} PDF-uri într-un singur câmp.`)
    return
  }

  const used = new Set()
  for (let documentIndex = 0; documentIndex < documents.length; documentIndex += 1) {
    const document = documents[documentIndex]
    let targetIndex = Number.isInteger(document.fieldIndex) ? Number(document.fieldIndex) : -1

    if (targetIndex < 0 && document.label) {
      const ranked = metadata
        .filter((field) => !used.has(field.index))
        .map((field) => ({ ...field, score: matchScore(document.label, field.description) }))
        .sort((a, b) => b.score - a.score)
      if (ranked[0]?.score > 0) targetIndex = ranked[0].index
    }

    const safeOrderFallback = !document.label || documents.length === metadata.length
    if (targetIndex < 0 && safeOrderFallback && documentIndex < metadata.length) targetIndex = documentIndex
    if (targetIndex < 0 || targetIndex >= metadata.length || used.has(targetIndex)) {
      const fields = metadata.map((field) => `[${field.index}] ${field.description || 'fără etichetă'}`).join('\n')
      throw new Error(`Nu am putut asocia PDF-ul „${document.label || path.basename(document.file)}”.\nCâmpuri detectate:\n${fields}`)
    }

    await inputs.nth(targetIndex).setInputFiles(document.file)
    used.add(targetIndex)
    console.log(`Atașat: ${path.basename(document.file)} → ${metadata[targetIndex].description || `câmpul ${targetIndex}`}`)
  }
}

async function launchChrome() {
  let lastError
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless: false })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

async function main() {
  const configPath = argumentValue('--config') || process.argv.find((argument, index) => index > 1 && !argument.startsWith('--'))
  if (!configPath) {
    console.error('Utilizare: npm run deer:assist -- --config "C:\\cale\\deer-ATR.json"')
    process.exitCode = 1
    return
  }

  const job = await loadJob(configPath)
  console.log(`Configurație validă: ATR ${job.dossierNumber}, ${job.documents.length} PDF-uri.`)
  if (process.argv.includes('--validate')) return

  const browser = await launchChrome()
  const context = await browser.newContext()
  const page = await context.newPage()
  const terminal = createInterface({ input: process.stdin, output: process.stdout })

  try {
    await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded' })
    await fillField(page, 'Număr dosar', job.dossierNumber, 0)
    await fillField(page, 'Nume solicitant', job.applicant, 1)
    await fillField(page, 'Localitate', job.locality, 2)
    await fillField(page, 'Strada', job.street, 3)
    await selectAction(page, job)
    await fillField(page, 'Adresă Email', FIXED_EMAIL, 4)

    console.log('\nDatele au fost completate. Completează CAPTCHA în Chrome și apasă „Mai departe”.')
    await page.locator('input[type="file"]').first().waitFor({ state: 'attached', timeout: CAPTCHA_WAIT_MS })
    console.log('CAPTCHA acceptat; a fost detectată etapa de încărcare.')

    await uploadDocuments(page, job.documents)
    console.log('\nPDF-urile configurate au fost atașate. Verifică pagina și trimite manual formularul.')
    await terminal.question('Apasă ENTER aici numai după ce ai terminat, pentru a închide browserul...')
  } finally {
    terminal.close()
    await browser.close()
  }
}

main().catch((error) => {
  console.error(`\nEroare: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})
