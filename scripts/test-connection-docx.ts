import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import PizZip from 'pizzip'
import { XMLValidator } from 'fast-xml-parser'
import { connectionAmountToWordsRO } from '../lib/connection-amount-words'
import { connectionDocumentName, generateConnectionDocx, parseConnectionMoney } from '../lib/connection-docx'
import { defaultConnectionFields } from '../lib/connection-fields'

function paragraphWith(xml: string, marker: string) {
  const at = xml.indexOf(marker)
  assert.ok(at >= 0, `Lipsește ${marker}`)
  return xml.slice(xml.lastIndexOf('<w:p ', at), xml.indexOf('</w:p>', at) + 6)
}

function paragraphWithVisibleText(xml: string, marker: string) {
  const paragraph = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((match) => match[0]).find((item) => visibleText(item).includes(marker))
  assert.ok(paragraph, `Lipsește paragraful cu ${marker}`)
  return paragraph
}

function visibleText(xml: string) {
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join('')
}

function renderedText(xml: string) {
  return [...xml.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)]
    .filter((match) => !/<w:vanish\b/.test(match[0]))
    .map((match) => visibleText(match[0])).join('')
}

function assertFullTemplateStructure(template: string, output: string) {
  assert.equal((output.match(/<w:p\b/g) || []).length, (template.match(/<w:p\b/g) || []).length,
    'Numărul și poziția paragrafelor trebuie păstrate în pachetul complet')
  for (const marker of [/<w:tbl\b/g, /<w:sectPr\b/g, /<w:pict\b/g]) {
    assert.equal((output.match(marker) || []).length, (template.match(marker) || []).length,
      `Structura ${marker.source} trebuie păstrată din șablon`)
  }
  assert.deepEqual(output.match(/<v:rect\b[^>]*>/g) || [], template.match(/<v:rect\b[^>]*>/g) || [],
    'Chenarele VML și ancorele lor trebuie păstrate din șablon')
}

function precedingParagraph(xml: string, marker: string) {
  const at = xml.indexOf(marker)
  assert.ok(at >= 0, `Lipsește ${marker}`)
  return [...xml.slice(0, at).matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].at(-1)?.[0] || ''
}

function assertSingleBreakBeforeNotification(xml: string) {
  const boundary = precedingParagraph(xml, 'Către Distribuție Energie')
  assert.ok(boundary.includes('<w:sectPr'), 'Lipsește schimbarea de secțiune înainte de notificare')
  assert.ok(!/<w:br\b(?=[^>]*w:type="page")/.test(boundary), 'A rămas un al doilea salt de pagină înainte de notificare')
}

function firstTextRunStyle(paragraph: string) {
  const run = [...paragraph.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)].find((match) => /<w:t\b/.test(match[0]))?.[0] || ''
  return /<w:rPr\b[\s\S]*?<\/w:rPr>/.exec(run)?.[0] || ''
}

function textRunStyles(paragraph: string) {
  return [...paragraph.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)]
    .map((match) => match[0]).filter((run) => /<w:t\b/.test(run))
    .map((run) => /<w:rPr\b[\s\S]*?<\/w:rPr>/.exec(run)?.[0] || '')
}

async function main() {
  const templateXml = new PizZip(await fs.readFile('assets/bransamente/contract-template.docx')).file('word/document.xml')!.asText()
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

  const fields = { ...defaultConnectionFields(), TipBeneficiar: 'PF', Beneficiar: 'PETKES JULIA-CSILLA', CNP: '2880719314012', SumaFaraTVA: '2430.00' }
  const contractBuffer = await generateConnectionDocx(fields, 'contract')
  if (process.env.CONNECTION_DOCX_SAMPLE_PATH) await fs.writeFile(process.env.CONNECTION_DOCX_SAMPLE_PATH, contractBuffer)
  const contract = new PizZip(contractBuffer)
  const xml = contract.file('word/document.xml')!.asText()
  assert.equal(XMLValidator.validate(xml), true)
  const price = visibleText(paragraphWith(xml, 'w:name="SumaFaraTVA"'))
  assert.match(price, /2430\.00\s+lei\s+\(două mii patru sute treizeci, 00\)\s+lei/)
  assert.ok(xml.includes('NOTIFICARE ÎNCHEIERE CONTRACT'))
  assert.ok(xml.includes('MEMORIU  TEHNIC'))
  assert.ok(xml.includes('CEREREA PENTRU ELIBERAREA AUTORIZATIEI'))
  assertFullTemplateStructure(templateXml, xml)
  assert.match(visibleText(paragraphWith(xml, 'w:name="Telefon"')), /CNP 2880719314012/)
  assert.equal(
    textRunStyles(paragraphWith(xml, 'w:name="Telefon"')).at(-1),
    textRunStyles(paragraphWithVisibleText(templateXml, '0744165317')).at(-1),
    'CNP-ul adăugat în contract păstrează stilul valorii Telefon',
  )
  const physicalNotificationParagraph = paragraphWithVisibleText(xml, '• PERSOANĂ FIZICĂ')
  assert.match(visibleText(physicalNotificationParagraph), /PETKES JULIA-CSILLA.*CNP 2880719314012/)
  const physicalSourceStyles = textRunStyles(paragraphWithVisibleText(templateXml, '•PERSOANĂ FIZICĂ'))
  const physicalOutputStyles = textRunStyles(physicalNotificationParagraph)
  assert.deepEqual(physicalOutputStyles.slice(0, 3), physicalSourceStyles.slice(0, 3), 'Păstrează stilul bulinei, al titlului subliniat și al separatorului PF')
  assert.equal(physicalOutputStyles[4], physicalSourceStyles[5], 'Numele PF păstrează stilul valorii din șablon')
  assert.ok(visibleText(xml).includes('•PERSOANĂ JURIDICĂ'), 'Rubrica juridică rămâne în structura originală')
  assert.ok(!xml.includes('NEJUR MIRCEA'))
  assertSingleBreakBeforeNotification(xml)
  assert.equal(connectionDocumentName(fields, 'contract'), 'Contract-Notificare-Memoriu-Cerere-PETKES-JULIA-CSILLA.docx')

  const signing = new PizZip(await generateConnectionDocx(fields, 'contract', 'contract-notification'))
  const signingXml = signing.file('word/document.xml')!.asText()
  assert.equal(XMLValidator.validate(signingXml), true)
  assert.match(visibleText(paragraphWith(signingXml, 'w:name="SumaFaraTVA"')), /2430\.00\s+lei\s+\(două mii patru sute treizeci, 00\)\s+lei/)
  assert.ok(signingXml.includes('NOTIFICARE ÎNCHEIERE CONTRACT'))
  assert.ok(!signingXml.includes('MEMORIU  TEHNIC'))
  assert.ok(!signingXml.includes('CEREREA PENTRU ELIBERAREA AUTORIZATIEI'))
  assertSingleBreakBeforeNotification(signingXml)
  assert.equal(connectionDocumentName(fields, 'contract', 'contract-notification'), 'Contract-Notificare-PETKES-JULIA-CSILLA.docx')

  const legalFields = {
    ...defaultConnectionFields(), TipBeneficiar: 'PJ', Beneficiar: 'PAROHIA REFORMATA VALEA POMILOR',
    CUI: '4289964', Oras: 'ȘAMȘUD', Sat: 'VALEA POMILOR', Judet: 'SĂLAJ',
    Strada: 'PRINCIPALĂ', Nr: '119', Telefon: '0749393854', SumaFaraTVA: '2420.00',
    NrSX: 'SX-VECHI-99', DataSX: '01.01.2000', DataExpirareSX: '01.01.2005',
  }
  for (const part of ['full', 'contract-notification'] as const) {
    const legalBuffer = await generateConnectionDocx(legalFields, 'contract', part)
    if (part === 'full' && process.env.CONNECTION_DOCX_LEGAL_SAMPLE_PATH) await fs.writeFile(process.env.CONNECTION_DOCX_LEGAL_SAMPLE_PATH, legalBuffer)
    const legalXml = new PizZip(legalBuffer).file('word/document.xml')!.asText()
    assert.equal(XMLValidator.validate(legalXml), true)
    assert.equal((legalXml.match(/w:name="Beneficiar"/g) || []).length, 1, 'Sursa REF Beneficiar trebuie păstrată')
    assert.ok(paragraphWith(legalXml, 'w:name="Beneficiar"').includes('<w:vanish/>'), 'Bookmarkul PF trebuie ascuns în actul PJ')
    assert.ok(!renderedText(paragraphWith(legalXml, 'NUME SI PRENUME')).includes('PAROHIA'), 'Blocul PF trebuie să rămână necompletat')
    assert.equal(renderedText(paragraphWithVisibleText(legalXml, 'NUME SI PRENUME')).trim(), 'NUME SI PRENUME –')
    assert.ok(!renderedText(paragraphWithVisibleText(legalXml, 'ADRESA DE DOMICILIU')).includes('VALEA POMILOR'))
    assert.equal(renderedText(paragraphWithVisibleText(legalXml, 'Telefon –')).trim(), 'Telefon –')
    const legalParagraphs = [...legalXml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((match) => match[0])
    assert.equal(visibleText(legalParagraphs[13]), '', 'Separatorul original dintre casetele PF/PJ rămâne gol')
    assert.ok(!legalParagraphs[13].includes('<w:bookmarkStart'), 'Bookmarkurile nu se mută în separator')
    assert.match(visibleText(paragraphWith(legalXml, 'DENUMIRE –')), /PAROHIA REFORMATA VALEA POMILOR/)
    assert.match(visibleText(paragraphWith(legalXml, 'C.U.I.\/C.I.F.')), /4289964/)
    const legalNotificationParagraph = paragraphWithVisibleText(legalXml, '•PERSOANĂ JURIDICĂ')
    assert.match(visibleText(legalNotificationParagraph), /PAROHIA REFORMATA VALEA POMILOR.*ȘAMȘUD/)
    const legalSourceStyles = textRunStyles(paragraphWithVisibleText(templateXml, '•PERSOANĂ JURIDICĂ'))
    const legalOutputStyles = textRunStyles(legalNotificationParagraph)
    assert.deepEqual(legalOutputStyles.slice(0, 3), legalSourceStyles.slice(0, 3), 'Păstrează stilul bulinei, al titlului subliniat și al separatorului PJ')
    assert.deepEqual(legalOutputStyles, legalSourceStyles, 'Rubrica PJ păstrează stilurile tuturor segmentelor originale')
    assert.ok(!legalXml.includes('J31/123/2026'), 'Un nr. Registrul Comerțului necunoscut nu trebuie inventat')
    assert.ok(!renderedText(legalXml).includes('SX-VECHI-99'), 'Un act PJ nu include numărul SX moștenit')
    assert.ok(!renderedText(legalXml).includes('01.01.2000'), 'Un act PJ nu include data SX moștenită')
    assert.ok(!renderedText(legalXml).includes('01.01.2005'), 'Un act PJ nu include data expirării SX moștenită')
    const referenceInstructions = [...legalXml.matchAll(/<w:instrText\b[^>]*>([^<]*\bREF\s+[A-Za-z][^<]*)<\/w:instrText>/gi)]
      .map((match) => match[1])
    assert.ok(referenceInstructions.length > 0)
    assert.ok(referenceInstructions.every((instruction) => /\\\*\s*(?:MERGEFORMAT|CHARFORMAT)/i.test(instruction)),
      'REF păstrează formatul rezultatului când Word actualizează bookmarkurile ascunse')
    assert.equal(firstTextRunStyle(paragraphWith(legalXml, 'DENUMIRE –')), firstTextRunStyle(paragraphWithVisibleText(templateXml, 'DENUMIRE')))
    for (const [generated, source] of [
      ['ADRESA SEDIULUI –', 'ADRESA SEDIULUI'],
      ['Telefon 0749393854', 'Reprezentant legal'],
    ]) {
      assert.equal(firstTextRunStyle(paragraphWithVisibleText(legalXml, generated)),
        firstTextRunStyle(paragraphWithVisibleText(templateXml, source)),
        `Textul PJ ${generated} păstrează fontul și dimensiunea paragrafului sursă`)
    }
    assert.equal(firstTextRunStyle(paragraphWithVisibleText(legalXml, 'C.U.I./C.I.F.')),
      firstTextRunStyle(paragraphWithVisibleText(templateXml, 'C.I.F')))
    assert.equal(firstTextRunStyle(paragraphWithVisibleText(legalXml, 'telefon 0749393854')),
      firstTextRunStyle(paragraphWithVisibleText(templateXml, 'reprezentată prin Director')))
    assert.ok(visibleText(legalXml).includes('• PERSOANĂ FIZICĂ'), 'Rubrica PF rămâne în poziția originală')
    assert.ok(!renderedText(paragraphWithVisibleText(legalXml, '• PERSOANĂ FIZICĂ')).includes('PAROHIA'))
    assertSingleBreakBeforeNotification(legalXml)
    if (part === 'full') {
      assertFullTemplateStructure(templateXml, legalXml)
      assert.ok(legalXml.includes('MEMORIU  TEHNIC'))
      assert.ok(legalXml.includes('CEREREA PENTRU ELIBERAREA AUTORIZATIEI'))
      assert.match(visibleText(paragraphWithVisibleText(legalXml, 'Denumirea lucrarii')), /PAROHIA REFORMATA VALEA POMILOR/)
      assert.match(visibleText(paragraphWithVisibleText(legalXml, 'Costul  lucrarilor')), /PAROHIA REFORMATA VALEA POMILOR/)
      for (const label of ['Denumirea lucrarii', 'Costul  lucrarilor']) {
        assert.deepEqual(textRunStyles(paragraphWithVisibleText(legalXml, label)),
          textRunStyles(paragraphWithVisibleText(templateXml, label)),
          `Memoriul păstrează stilurile existente pentru ${label}`)
      }
    } else {
      assert.ok(!legalXml.includes('MEMORIU  TEHNIC'))
      assert.ok(!legalXml.includes('CEREREA PENTRU ELIBERAREA AUTORIZATIEI'))
    }
  }

  const companyXml = new PizZip(await generateConnectionDocx({
    ...legalFields, Beneficiar: 'SC EXEMPLU SRL', CUI: 'RO12345678',
    NrRegCom: 'J31/123/2026', ReprezentantLegal: 'IONESCU MARIA', FunctieReprezentant: 'Administrator',
  }, 'contract')).file('word/document.xml')!.asText()
  assert.match(visibleText(paragraphWith(companyXml, 'Nr. înreg. Registrul Comerțului')), /J31\/123\/2026.*RO12345678/)
  assert.match(visibleText(paragraphWith(companyXml, 'Reprezentant legal')), /IONESCU MARIA.*Administrator/)
  assert.match(visibleText(paragraphWith(companyXml, 'nr. înreg.')), /J31\/123\/2026.*IONESCU MARIA.*Administrator/)

  const a3 = new PizZip(await generateConnectionDocx(fields, 'a3'))
  assert.ok(a3.file('word/document.xml')!.asText().length > 0)
  console.log('Pachet complet și DEER, PF/PJ în contract/notificare/memoriu, salt de pagină, sumă în litere, A3: OK')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
