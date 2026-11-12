import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import PizZip from 'pizzip'
import { XMLValidator } from 'fast-xml-parser'
import { connectionAmountToWordsRO } from '../lib/connection-amount-words'
import { generateConnectionDocx, parseConnectionMoney } from '../lib/connection-docx'
import { defaultConnectionFields } from '../lib/connection-fields'

function paragraphWith(xml: string, marker: string) {
  const at = xml.indexOf(marker)
  assert.ok(at >= 0, `Lipsește ${marker}`)
  return xml.slice(xml.lastIndexOf('<w:p ', at), xml.indexOf('</w:p>', at) + 6)
}

function visibleText(xml: string) {
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join('')
}

async function main() {
  for (const [input, expected] of [
    ['2430.00', 'două mii patru sute treizeci, 00'],
    ['2430,46', 'două mii patru sute treizeci, 46'],
    ['1.234,05', 'o mie două sute treizeci și patru, 05'],
    ['21.000,00', 'douăzeci și una de mii, 00'],
    ['0.01', 'zero, 01'],
  ]) {
    const amount = parseConnectionMoney(input)
    assert.notEqual(amount, null)
    assert.equal(connectionAmountToWordsRO(amount!), expected)
  }

  const fields = { ...defaultConnectionFields(), Beneficiar: 'PETKES JULIA-CSILLA', SumaFaraTVA: '2430.00' }
  const contractBuffer = await generateConnectionDocx(fields, 'contract')
  if (process.env.CONNECTION_DOCX_SAMPLE_PATH) await fs.writeFile(process.env.CONNECTION_DOCX_SAMPLE_PATH, contractBuffer)
  const contract = new PizZip(contractBuffer)
  const xml = contract.file('word/document.xml')!.asText()
  assert.equal(XMLValidator.validate(xml), true)
  const price = visibleText(paragraphWith(xml, 'w:name="SumaFaraTVA"'))
  assert.match(price, /2430\.00\s+lei\s+\(două mii patru sute treizeci, 00\)\s+lei/)
  assert.ok(xml.includes('NOTIFICARE ÎNCHEIERE CONTRACT'))
  assert.ok(!xml.includes('MEMORIU  TEHNIC'))
  assert.ok(!xml.includes('CEREREA PENTRU ELIBERAREA AUTORIZATIEI'))

  const a3 = new PizZip(await generateConnectionDocx(fields, 'a3'))
  assert.ok(a3.file('word/document.xml')!.asText().length > 0)
  console.log('Contractul și notificarea, suma în litere și dosarul A3: OK')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
