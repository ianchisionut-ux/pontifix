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

function assertBoldItalicValue(paragraph: string, value: string) {
  const run = [...paragraph.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)]
    .map((match) => match[0]).find((item) => visibleText(item).includes(value))
  assert.ok(run, `Lipsește valoarea ${value} din run`)
  assert.match(run, /<w:b(?:\s|\/|>)/, `Valoarea ${value} trebuie să fie bold`)
  assert.match(run, /<w:i(?:\s|\/|>)/, `Valoarea ${value} trebuie să fie italic`)
}

function assertArialTenValue(paragraph: string, value: string) {
  const run = [...paragraph.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)]
    .map((match) => match[0]).find((item) => visibleText(item).includes(value))
  assert.ok(run, `Lipsește valoarea ${value} din notificare`)
  assert.match(run, /<w:rFonts\b[^>]*w:ascii="Arial"/, `${value} trebuie să fie Arial`)
  assert.match(run, /<w:sz\b[^>]*w:val="20"/, `${value} trebuie să aibă 10 pt`)
}

function assertNotificationHasNoTimes(xml: string) {
  const address = xml.indexOf('Către Distribuție Energie')
  const start = xml.lastIndexOf('<w:p ', address)
  const boundary = xml.indexOf('w:name="SigningEnd"', address)
  const end = boundary >= 0 ? boundary : xml.indexOf('</w:body>', address)
  assert.ok(start >= 0 && end > start, 'Notificarea trebuie să aibă limitele din șablon')
  const notification = xml.slice(start, end)
  const runs = [...notification.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)]
    .map((match) => match[0]).filter((run) => visibleText(run).trim())
  assert.ok(runs.length > 0)
  for (const run of runs) {
    assert.doesNotMatch(run, /<w:rFonts\b[^>]*Times New Roman/, `Notificarea conține Times New Roman: ${visibleText(run)}`)
    assert.match(run, /<w:rFonts\b[^>]*w:ascii="Arial(?: Narrow)?"[^>]*w:hAnsi="Arial(?: Narrow)?"/,
      `Notificarea are un font diferit de șablonul Arial: ${visibleText(run)}`)
  }
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

  const fields = {
    ...defaultConnectionFields(), TipBeneficiar: 'PF', Beneficiar: 'PETKES JULIA-CSILLA', CNP: '2880719314012',
    Strada: 'FLORILOR', Nr: '42', Telefon: '0744165317', CiSerie: 'SX', CiNumar: '429575',
    CiEmisaDe: 'SPCLEP ZALAU', CiValabilaDeLa: '01.01.2025', PTA: 'PTA 6729 TEST', SumaFaraTVA: '2430.00',
  }
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
  for (const value of [fields.Beneficiar, fields.Oras, fields.Strada, fields.Nr, fields.Telefon, fields.CNP]) {
    assertBoldItalicValue(physicalNotificationParagraph, value)
  }
  assertArialTenValue(physicalNotificationParagraph, fields.Strada)
  const physicalIdentity = paragraphWithVisibleText(xml, 'având C.I. seria')
  for (const value of [fields.CiSerie, fields.CiNumar, fields.CiEmisaDe, fields.CiValabilaDeLa]) {
    assertBoldItalicValue(physicalIdentity, value)
    assert.equal(visibleText(physicalIdentity).split(value).length - 1, 1, `Valoarea CI ${value} apare o singură dată`)
  }
  assert.match(visibleText(physicalIdentity), /cont nr\. \.{8}, deschis la \.{8}, filiala \.{8}/,
    'Punctele de completare pentru contul opțional rămân vizibile')
  assert.ok(physicalIdentity.includes('w:name="NrSX"'), 'Bookmarkul actului de identitate rămâne în paragraf')
  const memoriu = xml.slice(xml.indexOf('MEMORIU  TEHNIC'))
  assertBoldItalicValue(paragraphWithVisibleText(memoriu, fields.PTA), fields.PTA)
  assert.ok(visibleText(xml).includes('•PERSOANĂ JURIDICĂ'), 'Rubrica juridică rămâne în structura originală')
  assert.ok(!xml.includes('NEJUR MIRCEA'))
  assertSingleBreakBeforeNotification(xml)
  assertNotificationHasNoTimes(xml)
  assert.equal(connectionDocumentName(fields, 'contract'), 'Contract-Notificare-Memoriu-Cerere-PETKES-JULIA-CSILLA.docx')

  const signing = new PizZip(await generateConnectionDocx(fields, 'contract', 'contract-notification'))
  const signingXml = signing.file('word/document.xml')!.asText()
  assert.equal(XMLValidator.validate(signingXml), true)
  assert.match(visibleText(paragraphWith(signingXml, 'w:name="SumaFaraTVA"')), /2430\.00\s+lei\s+\(două mii patru sute treizeci, 00\)\s+lei/)
  assert.ok(signingXml.includes('NOTIFICARE ÎNCHEIERE CONTRACT'))
  assert.ok(!signingXml.includes('MEMORIU  TEHNIC'))
  assert.ok(!signingXml.includes('CEREREA PENTRU ELIBERAREA AUTORIZATIEI'))
  assertSingleBreakBeforeNotification(signingXml)
  assertNotificationHasNoTimes(signingXml)
  assert.equal(connectionDocumentName(fields, 'contract', 'contract-notification'), 'Contract-Notificare-PETKES-JULIA-CSILLA.docx')

  for (const [part, present, absent, filename] of [
    ['contract-only', 'Contract', ['NOTIFICARE ÎNCHEIERE CONTRACT', 'MEMORIU  TEHNIC', 'CEREREA PENTRU ELIBERAREA AUTORIZATIEI'], 'Contract-PETKES-JULIA-CSILLA.docx'],
    ['notification-only', 'NOTIFICARE ÎNCHEIERE CONTRACT', ['CAP.II', 'MEMORIU  TEHNIC', 'CEREREA PENTRU ELIBERAREA AUTORIZATIEI'], 'Notificare-PETKES-JULIA-CSILLA.docx'],
    ['memorandum-only', 'MEMORIU  TEHNIC', ['NOTIFICARE ÎNCHEIERE CONTRACT', 'CEREREA PENTRU ELIBERAREA AUTORIZATIEI'], 'Memoriu-PETKES-JULIA-CSILLA.docx'],
    ['request-only', 'CEREREA PENTRU ELIBERAREA AUTORIZATIEI', ['NOTIFICARE ÎNCHEIERE CONTRACT', 'MEMORIU  TEHNIC'], 'Cerere-PETKES-JULIA-CSILLA.docx'],
  ] as const) {
    const singleXml = new PizZip(await generateConnectionDocx(fields, 'contract', part)).file('word/document.xml')!.asText()
    assert.equal(XMLValidator.validate(singleXml), true, `${part} trebuie să fie XML valid`)
    assert.ok(singleXml.includes(present), `${part} trebuie să includă secțiunea sa`)
    for (const marker of absent) assert.ok(!singleXml.includes(marker), `${part} nu trebuie să includă ${marker}`)
    assert.equal((singleXml.match(/<w:sectPr\b/g) || []).length, 1, `${part} trebuie să aibă o singură secțiune Word`)
    assert.ok(!/<w:instrText\b[^>]*>[^<]*\bREF\s+[A-Za-z]/i.test(singleXml), `${part} nu lasă referințe fără sursă`)
    assert.ok(!/<w:instrText\b[^>]*>[^<]*=\s*(?:SUM|PRODUCT)\b/i.test(singleXml),
      `${part} păstrează rezultatul formulelor fără trimiteri către alt document`)
    assert.equal(connectionDocumentName(fields, 'contract', part), filename)
    if (part === 'notification-only') assertNotificationHasNoTimes(singleXml)
    const firstBody = singleXml.slice(singleXml.indexOf('<w:body>') + 8, singleXml.indexOf('</w:body>'))
    const firstParagraph = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/.exec(firstBody)?.[0] || ''
    assert.ok(!/<w:br\b(?=[^>]*w:type="page")/.test(firstParagraph), `${part} nu începe cu pagină goală`)
  }

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
    for (const value of [legalFields.Beneficiar, legalFields.Oras, legalFields.Sat]) {
      assertBoldItalicValue(legalNotificationParagraph, value)
    }
    for (const [marker, values] of [
      ['DENUMIRE –', [legalFields.Beneficiar]],
      ['ADRESA SEDIULUI –', [legalFields.Oras, legalFields.Sat]],
      ['str. PRINCIPALĂ, nr. 119', [legalFields.Strada, legalFields.Nr, legalFields.Judet]],
      ['C.U.I./C.I.F.', [legalFields.CUI]],
      ['Telefon 0749393854', [legalFields.Telefon]],
    ] as const) {
      const paragraph = paragraphWithVisibleText(legalXml, marker)
      for (const value of values) assertBoldItalicValue(paragraph, value)
    }
    const legalAddress = paragraphWithVisibleText(legalXml, 'str. PRINCIPALĂ, nr. 119, județ')
    for (const value of [legalFields.Strada, legalFields.Nr, legalFields.Judet, legalFields.Telefon, legalFields.CUI]) {
      assertBoldItalicValue(legalAddress, value)
      assertArialTenValue(legalAddress, value)
    }
    assertNotificationHasNoTimes(legalXml)
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

  for (const part of ['contract-only', 'notification-only', 'memorandum-only', 'request-only'] as const) {
    const legalSingle = new PizZip(await generateConnectionDocx(legalFields, 'contract', part)).file('word/document.xml')!.asText()
    assert.equal(XMLValidator.validate(legalSingle), true, `${part} PJ trebuie să fie XML valid`)
    assert.ok(renderedText(legalSingle).includes(legalFields.Beneficiar), `${part} PJ include beneficiarul completat`)
    assert.ok(!/<w:instrText\b[^>]*>[^<]*\bREF\s+[A-Za-z]/i.test(legalSingle),
      `${part} PJ nu păstrează referințe către celelalte documente`)
    if (part === 'contract-only') {
      assert.ok(!renderedText(paragraphWithVisibleText(legalSingle, 'NUME SI PRENUME')).includes(legalFields.Beneficiar),
        'Contractul PJ nu completează rubrica PF')
    }
    if (part === 'notification-only') {
      assertNotificationHasNoTimes(legalSingle)
      assert.ok(!renderedText(paragraphWithVisibleText(legalSingle, '• PERSOANĂ FIZICĂ')).includes(legalFields.Beneficiar),
        'Notificarea PJ nu completează rubrica PF')
      assertBoldItalicValue(paragraphWithVisibleText(legalSingle, '•PERSOANĂ JURIDICĂ'), legalFields.Beneficiar)
    }
  }

  const companyXml = new PizZip(await generateConnectionDocx({
    ...legalFields, Beneficiar: 'SC EXEMPLU SRL', CUI: 'RO12345678',
    NrRegCom: 'J31/123/2026', ReprezentantLegal: 'IONESCU MARIA', FunctieReprezentant: 'Administrator',
  }, 'contract')).file('word/document.xml')!.asText()
  assert.match(visibleText(paragraphWith(companyXml, 'Nr. înreg. Registrul Comerțului')), /J31\/123\/2026.*RO12345678/)
  assert.match(visibleText(paragraphWith(companyXml, 'Reprezentant legal')), /IONESCU MARIA.*Administrator/)
  assert.match(visibleText(paragraphWith(companyXml, 'nr. înreg.')), /J31\/123\/2026.*IONESCU MARIA.*Administrator/)

  const parochiaA3 = new PizZip(await generateConnectionDocx({
    ...legalFields, AmplasamentA3: 'județul Sălaj, - ȘAMȘUD, sat VALEA POMILOR, nr. 78', Nrloc: '',
  }, 'a3')).file('word/document.xml')!.asText()
  assert.equal(XMLValidator.validate(parochiaA3), true)
  const a3Beneficiary = paragraphWith(parochiaA3, 'w:name="Beneficiar"')
  assert.equal(/<w:t\b[^>]*>( +)<\/w:t>/.exec(a3Beneficiary)?.[1].length, 48,
    'Numele parohiei are aceeași poziție de 48 spații ca exemplul aranjat manual')
  const parochiaAddress = paragraphWith(parochiaA3, 'w:name="AmplasamentA3"')
  const parochiaAddressIndex = parochiaA3.indexOf(parochiaAddress)
  const parochiaAddressLine = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/.exec(parochiaA3.slice(parochiaAddressIndex + parochiaAddress.length))?.[0] || ''
  assert.match(visibleText(parochiaAddressLine), /sat VALEA POMILOR, nr\. 78/)
  assert.equal((visibleText(parochiaAddressLine).match(/nr\./g) || []).length, 1, 'Numărul nu se dublează dacă Nrloc este gol')
  const physicalA3 = new PizZip(await generateConnectionDocx({
    ...fields, AmplasamentA3: 'județul TEST, - ORAȘ TEST, str. FLORILOR nr. 42', Nrloc: '',
  }, 'a3')).file('word/document.xml')!.asText()
  const physicalAddress = paragraphWith(physicalA3, 'w:name="AmplasamentA3"')
  const physicalAddressIndex = physicalA3.indexOf(physicalAddress)
  const physicalAddressLine = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/.exec(physicalA3.slice(physicalAddressIndex + physicalAddress.length))?.[0] || ''
  assert.match(visibleText(physicalAddressLine), /str\. FLORILOR nr\. 42/)
  assert.equal((visibleText(physicalAddressLine).match(/nr\./g) || []).length, 1)

  const a3TemplateXml = new PizZip(await fs.readFile('assets/bransamente/a3-template.docx')).file('word/document.xml')!.asText()
  for (const [beneficiary, address, number] of [
    ['BENEFICIAR TEST', 'județul TEST, - ORAȘ TEST, str. FLORILOR, nr. 42', '42'],
    ['SOCIETATE EXEMPLU PENTRU TEST SRL', 'județul TEST, - ORAȘ TEST, sat SAT TEST, nr. 7', '7'],
  ]) {
    const a3Fields = {
      ...defaultConnectionFields(), Beneficiar: beneficiary, ATR: '123456789/05.06.2026',
      AmplasamentA3: address, Nrloc: number, NrContract: '10', DATA: '06.06.2026',
    }
    const a3Xml = new PizZip(await generateConnectionDocx(a3Fields, 'a3')).file('word/document.xml')!.asText()
    assert.equal(XMLValidator.validate(a3Xml), true)
    const paragraphs = [...a3Xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((match) => match[0])
    const templateParagraphs = [...a3TemplateXml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((match) => match[0])
    assert.equal(paragraphs.length, templateParagraphs.length + 2, 'A3 adaugă exact liniile pentru data ATR și amplasament')
    assert.equal((a3Xml.match(/<w:pict\b/g) || []).length, (a3TemplateXml.match(/<w:pict\b/g) || []).length,
      'Grafica formularului A3 rămâne neschimbată')
    assert.equal((a3Xml.match(/<w:sectPr\b/g) || []).length, (a3TemplateXml.match(/<w:sectPr\b/g) || []).length)
    const atrIndex = paragraphs.findIndex((paragraph) => paragraph.includes('w:name="ATR"'))
    assert.ok(atrIndex >= 0)
    assert.equal(visibleText(paragraphs[atrIndex]).trim(), '123456789')
    assert.equal(visibleText(paragraphs[atrIndex + 1]).trim(), '05.06.2026')
    assert.match(paragraphs[atrIndex + 1], /<w:bookmarkEnd\b(?=[^>]*w:id="3")/)
    assert.equal(firstTextRunStyle(paragraphs[atrIndex]), firstTextRunStyle(paragraphWith(a3TemplateXml, 'w:name="ATR"')))
    assert.equal(firstTextRunStyle(paragraphs[atrIndex + 1]), firstTextRunStyle(paragraphs[atrIndex]))
    const addressIndex = paragraphs.findIndex((paragraph) => paragraph.includes('w:name="AmplasamentA3"'))
    assert.ok(addressIndex >= 0)
    assert.match(visibleText(paragraphs[addressIndex]), /județul TEST, - ORAȘ TEST,/)
    assert.match(visibleText(paragraphs[addressIndex + 1]), /(?:str\. FLORILOR|sat SAT TEST).*nr\.\s*(?:42|7)/)
    assert.match(paragraphs[addressIndex + 1], /<w:bookmarkEnd\b(?=[^>]*w:id="5")/)
    assert.match(paragraphs[addressIndex + 1], /<w:bookmarkStart\b(?=[^>]*w:name="Nrloc")/)
    assert.equal((visibleText(paragraphs[addressIndex + 1]).match(new RegExp(`\\b${number}\\b`, 'g')) || []).length, 1,
      'Numărul locului de consum apare o singură dată')
    assert.equal(firstTextRunStyle(paragraphs[addressIndex]), firstTextRunStyle(paragraphWith(a3TemplateXml, 'w:name="AmplasamentA3"')))
    assert.equal(firstTextRunStyle(paragraphs[addressIndex + 1]), firstTextRunStyle(paragraphs[addressIndex]))
    assert.ok(!/<w:br\b(?=[^>]*w:type="page")/.test(paragraphs[atrIndex] + paragraphs[atrIndex + 1] + paragraphs[addressIndex] + paragraphs[addressIndex + 1]))
    assert.match(visibleText(paragraphWith(a3Xml, 'w:name="Beneficiar"')), new RegExp(beneficiary))
  }
  console.log('Pachet complet și DEER, PF/PJ în contract/notificare/memoriu, salt de pagină, sumă în litere, A3: OK')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
