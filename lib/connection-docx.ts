import fs from 'fs/promises'
import path from 'path'
import PizZip from 'pizzip'
import { CONNECTION_FIELDS, getConnectionBeneficiaryType, type ConnectionFields } from '@/lib/connection-fields'
import { connectionAmountToWordsRO } from '@/lib/connection-amount-words'

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceTextInRange(range: string, value: string, pad = true) {
  let used = false
  const replacement = xmlEscape(pad ? ` ${value.trim()} ` : value.trim())
  return range.replace(/<w:t([^>]*)>[\s\S]*?<\/w:t>/g, (_match, attributes: string) => {
    if (used) return `<w:t${attributes}></w:t>`
    used = true
    const attrs = /xml:space=/.test(attributes) ? attributes : `${attributes} xml:space="preserve"`
    return `<w:t${attrs}>${replacement}</w:t>`
  })
}

function replaceBookmark(xml: string, field: string, value: string, pad = true) {
  const escaped = regexEscape(field)
  const startPattern = new RegExp(`<w:bookmarkStart\\b(?=[^>]*w:name="${escaped}")(?=[^>]*w:id="([^"]+)")[^>]*/>`)
  const start = startPattern.exec(xml)
  if (!start) return xml
  const startEnd = start.index + start[0].length
  const endPattern = new RegExp(`<w:bookmarkEnd\\b(?=[^>]*w:id="${regexEscape(start[1])}")[^>]*/>`)
  const rest = xml.slice(startEnd)
  const end = endPattern.exec(rest)
  if (!end) return xml
  const absoluteEnd = startEnd + end.index
  const range = xml.slice(startEnd, absoluteEnd)
  return xml.slice(0, startEnd) + replaceTextInRange(range, value, pad) + xml.slice(absoluteEnd)
}

function keepContractAndNotification(xml: string) {
  const endMarker = /<w:bookmarkStart\b(?=[^>]*w:name="SigningEnd")[^>]*\/>/.exec(xml)
  if (!endMarker) throw new Error('Șablonul contractului nu conține limita de după notificare.')
  const cutAt = xml.lastIndexOf('<w:p ', endMarker.index)
  const bodyEnd = xml.lastIndexOf('</w:body>')
  const finalSection = xml.lastIndexOf('<w:sectPr ', bodyEnd)
  if (cutAt < 0 || finalSection <= cutAt) throw new Error('Notificarea nu poate fi separată din șablon.')
  return xml.slice(0, cutAt) + xml.slice(finalSection)
}

function replaceReferences(xml: string, field: string, value: string) {
  const escaped = regexEscape(field)
  const pattern = new RegExp(`(<w:fldChar\\b[^>]*w:fldCharType="begin"[^>]*/>[\\s\\S]*?<w:instrText\\b[^>]*>\\s*REF\\s+${escaped}(?:\\s+[^<]*)?<\\/w:instrText>[\\s\\S]*?<w:fldChar\\b[^>]*w:fldCharType="separate"[^>]*/>)([\\s\\S]*?)(<w:fldChar\\b[^>]*w:fldCharType="end"[^>]*/>)`, 'gi')
  return xml.replace(pattern, (_match, before: string, result: string, after: string) => `${before}${replaceTextInRange(result, value)}${after}`)
}

function replaceFormulaResult(xml: string, formulaStart: string, value: string) {
  const pattern = new RegExp(`(<w:fldChar\\b[^>]*w:fldCharType="begin"[^>]*/>[\\s\\S]{0,1800}?<w:instrText\\b[^>]*>\\s*${formulaStart}[^<]*<\\/w:instrText>[\\s\\S]{0,900}?<w:fldChar\\b[^>]*w:fldCharType="separate"[^>]*/>)([\\s\\S]*?)(<w:fldChar\\b[^>]*w:fldCharType="end"[^>]*/>)`, 'gi')
  return xml.replace(pattern, (_match, before: string, result: string, after: string) => `${before}${replaceTextInRange(result, value)}${after}`)
}

function paragraphText(paragraph: string) {
  return [...paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join('')
}

function foldText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

// Replace only the visible paragraph content. The legal-person sections in the
// source Word template are plain text, without bookmarks or REF fields.
function setParagraphText(paragraph: string, value: string) {
  const opening = /^<w:p\b[^>]*>/.exec(paragraph)?.[0]
  const properties = /<w:pPr\b[\s\S]*?<\/w:pPr>/.exec(paragraph)?.[0] || ''
  const firstTextRun = [...paragraph.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)].find((match) => /<w:t\b/.test(match[0]))?.[0] || ''
  const runProperties = /<w:rPr\b[\s\S]*?<\/w:rPr>/.exec(firstTextRun)?.[0] || ''
  if (!opening) throw new Error('Paragraf DOCX invalid în șablonul contractului.')
  return `${opening}${properties}<w:r>${runProperties}<w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r></w:p>`
}

function runLike(run: string, value: string) {
  const opening = /^<w:r\b[^>]*>/.exec(run)?.[0] || '<w:r>'
  const properties = /<w:rPr\b[\s\S]*?<\/w:rPr>/.exec(run)?.[0] || ''
  return `${opening}${properties}<w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r>`
}

function setNotificationApplicant(paragraph: string, name: string, suffix: string, physical: boolean) {
  const opening = /^<w:p\b[^>]*>/.exec(paragraph)?.[0]
  const properties = /<w:pPr\b[\s\S]*?<\/w:pPr>/.exec(paragraph)?.[0] || ''
  const runs = [...paragraph.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)]
    .map((match) => match[0]).filter((run) => /<w:t\b/.test(run))
  if (!opening || runs.length < (physical ? 10 : 3)) throw new Error('Paragraful solicitantului s-a modificat în șablon.')
  // The bullet, underlined heading, body text and highlighted name have
  // different formatting in the source notification. Keep each run's style.
  const bodyRun = physical ? runs[4] : runs[2]
  const nameRun = physical ? runs[5] : runs[2]
  return `${opening}${properties}${runLike(runs[0], '• ')}${runs[1]}${runLike(runs[2], ':')}`
    + `${runLike(bodyRun, physical ? ' D-nul/D-na ' : ' ')}${runLike(nameRun, name)}${runLike(bodyRun, suffix)}</w:p>`
}

function appendParagraphText(paragraph: string, value: string) {
  const textRuns = [...paragraph.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)].filter((match) => /<w:t\b/.test(match[0]))
  const runProperties = /<w:rPr\b[\s\S]*?<\/w:rPr>/.exec(textRuns.at(-1)?.[0] || '')?.[0] || ''
  return paragraph.replace(/<\/w:p>$/, `<w:r>${runProperties}<w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r></w:p>`)
}

// The Beneficiar/address/Telefon bookmarks live inside the original PF box.
// Keep them in a non-rendered paragraph for PJ documents: Word REF fields in
// the notification and memoriu must still have a live source after refresh.
function hiddenBookmarkSources(paragraphs: string[]) {
  const contents = paragraphs.map((paragraph) => paragraph
    .replace(/^<w:p\b[^>]*>/, '')
    .replace(/<w:pPr\b[\s\S]*?<\/w:pPr>/, '')
    .replace(/<\/w:p>$/, '')).join('')
  const hiddenRuns = contents.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
    if (/<w:rPr\b/.test(run)) return run.replace(/<w:rPr\b[^>]*>/, (opening) => `${opening}<w:vanish/>`)
    return run.replace(/^<w:r\b[^>]*>/, (opening) => `${opening}<w:rPr><w:vanish/></w:rPr>`)
  })
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr>${hiddenRuns}</w:p>`
}

function joinLocation(fields: ConnectionFields) {
  return [fields.Oras, fields.Sat].map((value) => value.trim()).filter(Boolean).join(', ')
}

function joinStreet(fields: ConnectionFields) {
  return [
    fields.Strada.trim() && `str. ${fields.Strada.trim()}`,
    fields.Nr.trim() && `nr. ${fields.Nr.trim()}`,
    fields.Bloc.trim() && `bl. ${fields.Bloc.trim()}`,
    fields.Ap.trim() && `ap. ${fields.Ap.trim()}`,
  ].filter(Boolean).join(', ')
}

function routeBeneficiarySections(xml: string, fields: ConnectionFields) {
  const matches = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)]
  const paragraphs = matches.map((match) => match[0])
  const folded = paragraphs.map((paragraph) => foldText(paragraphText(paragraph)).trim())
  const find = (prefix: string, after = 0) => folded.findIndex((text, index) => index >= after && text.startsWith(prefix))
  const physicalHeading = find('PERSOANA FIZICA')
  const legalHeading = find('PERSOANA JURIDICA', physicalHeading + 1)
  const contractEnd = find('CAP.II', legalHeading + 1)
  const legalNotification = find('•PERSOANA JURIDICA')
  const physicalNotification = find('•PERSOANA FIZICA', legalNotification + 1)
  const notificationBody = find('VA ADUCE LA CUNOSTINTA', physicalNotification + 1)
  const notificationAddress = find('CATRE DISTRIBUTIE', contractEnd + 1)
  if ([physicalHeading, legalHeading, contractEnd, legalNotification, physicalNotification, notificationBody, notificationAddress].some((index) => index < 0)) {
    throw new Error('Șablonul nu conține toate secțiunile beneficiarului din contract și notificare.')
  }

  const changes = new Map<number, string>()
  const remove = (start: number, end: number) => { for (let index = start; index < end; index++) changes.set(index, '') }
  // The original template places an explicit page break in the same paragraph
  // as the section break before the notification, producing an empty page.
  const boundary = paragraphs[notificationAddress - 1]
  if (!boundary.includes('<w:sectPr') || !/<w:br\b(?=[^>]*w:type="page")/.test(boundary)) {
    throw new Error('Limita dintre contract și notificare s-a modificat în șablon.')
  }
  changes.set(notificationAddress - 1, boundary.replace(/<w:br\b(?=[^>]*w:type="page")[^>]*\/>/, ''))
  if (getConnectionBeneficiaryType(fields) === 'PJ') {
    // Keep the two labeled boxes from the template. The inactive PF box stays
    // blank, while its bookmark values move into the otherwise empty spacer.
    changes.set(physicalHeading + 1, setParagraphText(paragraphs[physicalHeading + 1], 'NUME ȘI PRENUME –'))
    changes.set(physicalHeading + 2, setParagraphText(paragraphs[physicalHeading + 2], 'ADRESA DE DOMICILIU –'))
    changes.set(physicalHeading + 3, setParagraphText(paragraphs[physicalHeading + 3], 'Telefon –'))
    changes.set(physicalHeading + 4, hiddenBookmarkSources(paragraphs.slice(physicalHeading + 1, physicalHeading + 4)))
    changes.set(legalHeading + 1, setParagraphText(paragraphs[legalHeading + 1], `DENUMIRE – ${fields.Beneficiar.trim()}`))
    changes.set(legalHeading + 2, setParagraphText(paragraphs[legalHeading + 2], `ADRESA SEDIULUI – ${joinLocation(fields)}`))
    changes.set(legalHeading + 3, setParagraphText(paragraphs[legalHeading + 3], [joinStreet(fields), fields.Judet.trim() && `jud. ${fields.Judet.trim()}`].filter(Boolean).join(', ')))
    changes.set(legalHeading + 4, setParagraphText(paragraphs[legalHeading + 4], [
      fields.NrRegCom.trim() && `Nr. înreg. Registrul Comerțului ${fields.NrRegCom.trim()}`,
      fields.CUI.trim() && `C.U.I./C.I.F. ${fields.CUI.trim()}`,
    ].filter(Boolean).join(' · ')))
    changes.set(legalHeading + 5, setParagraphText(paragraphs[legalHeading + 5], [
      fields.Telefon.trim() && `Telefon ${fields.Telefon.trim()}`,
      fields.ReprezentantLegal.trim() && `Reprezentant legal ${fields.ReprezentantLegal.trim()}`,
      fields.FunctieReprezentant.trim() && `Funcția ${fields.FunctieReprezentant.trim()}`,
    ].filter(Boolean).join(' · ')))
    changes.set(legalNotification, setNotificationApplicant(
      paragraphs[legalNotification], fields.Beneficiar.trim(),
      joinLocation(fields) ? `, cu sediul în ${joinLocation(fields)}` : '', false,
    ))
    changes.set(legalNotification + 1, setParagraphText(paragraphs[legalNotification + 1], [
      joinStreet(fields), fields.Judet.trim() && `jud. ${fields.Judet.trim()}`,
      fields.CUI.trim() && `C.U.I./C.I.F. ${fields.CUI.trim()}`,
      fields.NrRegCom.trim() && `nr. înreg. ${fields.NrRegCom.trim()}`,
      fields.Telefon.trim() && `telefon ${fields.Telefon.trim()}`,
      fields.ReprezentantLegal.trim() && `reprezentată prin ${fields.ReprezentantLegal.trim()}`,
      fields.FunctieReprezentant.trim() && `funcția ${fields.FunctieReprezentant.trim()}`,
    ].filter(Boolean).join(', ')))
    remove(physicalNotification, notificationBody)
  } else {
    if (fields.CNP.trim()) changes.set(physicalHeading + 3, appendParagraphText(paragraphs[physicalHeading + 3], ` · CNP ${fields.CNP.trim()}`))
    remove(legalNotification, physicalNotification)
    const address = [joinLocation(fields), joinStreet(fields), fields.Judet.trim() && `jud. ${fields.Judet.trim()}`].filter(Boolean).join(', ')
    changes.set(physicalNotification, setNotificationApplicant(paragraphs[physicalNotification], fields.Beneficiar.trim(), [
      address && `domiciliat(ă) în ${address}`,
      fields.CNP.trim() && `CNP ${fields.CNP.trim()}`,
      fields.Telefon.trim() && `telefon ${fields.Telefon.trim()}`,
    ].filter(Boolean).map((part) => `, ${part}`).join(''), true))
    const identity = [
      fields.CiSerie.trim() && `C.I. seria ${fields.CiSerie.trim()}`,
      fields.CiNumar.trim() && `nr. ${fields.CiNumar.trim()}`,
      fields.CiEmisaDe.trim() && `eliberată de ${fields.CiEmisaDe.trim()}`,
      fields.CiValabilaDeLa.trim() && `la data de ${fields.CiValabilaDeLa.trim()}`,
    ].filter(Boolean).join(', ')
    changes.set(physicalNotification + 1, identity ? setParagraphText(paragraphs[physicalNotification + 1], identity) : '')
  }

  let cursor = 0
  let output = ''
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index]
    output += xml.slice(cursor, match.index) + (changes.get(index) ?? match[0])
    cursor = match.index! + match[0].length
  }
  return output + xml.slice(cursor)
}

export function parseConnectionMoney(value: string) {
  const compact = value.trim().replace(/\s+/g, '').replace(/[^\d.,-]/g, '')
  if (!compact) return null
  const dot = compact.lastIndexOf('.')
  const comma = compact.lastIndexOf(',')
  const decimalIndex = Math.max(dot, comma)
  let normalized = compact
  if (decimalIndex >= 0 && compact.length - decimalIndex - 1 <= 2) {
    normalized = compact.slice(0, decimalIndex).replace(/[.,]/g, '') + '.' + compact.slice(decimalIndex + 1).replace(/[.,]/g, '')
  } else {
    normalized = compact.replace(/[.,]/g, '')
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function money(value: number) {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2)
}

export type ConnectionContractPart = 'full' | 'contract-notification'

export async function generateConnectionDocx(fields: ConnectionFields, type: 'contract' | 'a3', part: ConnectionContractPart = 'full') {
  const filename = type === 'a3' ? 'a3-template.docx' : 'contract-template.docx'
  const buffer = await fs.readFile(path.join(process.cwd(), 'assets', 'bransamente', filename))
  const zip = new PizZip(buffer)
  const amount = parseConnectionMoney(fields.SumaFaraTVA)
  const documentFields = { ...fields, SumaFaraTVA: amount === null ? fields.SumaFaraTVA : money(amount) }
  const xmlFiles = Object.keys(zip.files).filter((name) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(name))
  for (const name of xmlFiles) {
    let xml = zip.file(name)?.asText() || ''
    for (const field of CONNECTION_FIELDS) {
      xml = replaceBookmark(xml, field, documentFields[field] || '')
      xml = replaceReferences(xml, field, documentFields[field] || '')
    }
    if (type === 'contract') {
      if (name === 'word/document.xml' && !xml.includes('w:name="SumaFaraTVALitere"')) {
        throw new Error('Șablonul contractului nu conține câmpul sumei în litere.')
      }
      xml = replaceBookmark(xml, 'SumaFaraTVALitere', amount === null ? '' : connectionAmountToWordsRO(amount), false)
    }
    if (type === 'contract' && amount !== null) {
      xml = replaceFormulaResult(xml, '=SUM\\s*\\(\\s*SumaFaraTVA', money(amount * 1.21))
      xml = replaceFormulaResult(xml, '=PRODUCT\\s*\\(\\s*SumaFaraTVA', money(amount * .21))
    }
    if (type === 'contract' && name === 'word/document.xml') xml = routeBeneficiarySections(xml, fields)
    if (type === 'contract' && part === 'contract-notification' && name === 'word/document.xml') xml = keepContractAndNotification(xml)
    zip.file(name, xml)
  }
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export function connectionDocumentName(fields: ConnectionFields, type: 'contract' | 'a3', part: ConnectionContractPart = 'full') {
  const beneficiary = (fields.Beneficiar || 'beneficiar').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return type === 'a3' ? `Dosar-A3-${beneficiary}.docx` : part === 'contract-notification' ? `Contract-Notificare-${beneficiary}.docx` : `Contract-Notificare-Memoriu-Cerere-${beneficiary}.docx`
}
