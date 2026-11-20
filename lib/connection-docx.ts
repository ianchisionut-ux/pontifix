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

function flattenReferenceFields(xml: string) {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const runs = [...paragraph.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)]
    const remove = new Set<number>()
    const stack: Array<{ start: number; separator: number }> = []
    for (let index = 0; index < runs.length; index++) {
      const run = runs[index][0]
      if (/<w:fldChar\b[^>]*w:fldCharType="begin"/.test(run)) stack.push({ start: index, separator: -1 })
      if (/<w:fldChar\b[^>]*w:fldCharType="separate"/.test(run) && stack.length) stack[stack.length - 1].separator = index
      if (/<w:fldChar\b[^>]*w:fldCharType="end"/.test(run) && stack.length) {
        const field = stack.pop()!
        if (field.separator >= 0 && /<w:instrText\b[^>]*>[^<]*(?:\bREF\s+[A-Za-z]|=\s*(?:SUM|PRODUCT)\b)/i.test(
          runs.slice(field.start, field.separator).map((item) => item[0]).join(''),
        )) {
          for (let part = field.start; part <= field.separator; part++) remove.add(part)
          remove.add(index)
        }
      }
    }
    if (!remove.size) return paragraph
    let cursor = 0
    let output = ''
    for (let index = 0; index < runs.length; index++) {
      const run = runs[index]
      output += paragraph.slice(cursor, run.index) + (remove.has(index) ? '' : run[0])
      cursor = run.index! + run[0].length
    }
    return output + paragraph.slice(cursor)
  })
}

function keepSingleContractPart(xml: string, part: Exclude<ConnectionContractPart, 'full' | 'contract-notification'>) {
  const paragraphs = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)]
  const text = paragraphs.map((match) => foldText(paragraphText(match[0])).trim())
  const find = (prefix: string) => text.findIndex((value) => value.startsWith(prefix))
  const notificationStart = find('CATRE DISTRIBUTIE')
  const signingEnd = paragraphs.findIndex((match) => /<w:bookmarkStart\b(?=[^>]*w:name="SigningEnd")/.test(match[0]))
  const requestHeading = find('CEREREA PENTRU ELIBERAREA AUTORIZATIEI')
  const requestPageBreak = paragraphs.findLastIndex((match, index) => index < requestHeading
    && /<w:br\b(?=[^>]*w:type="page")/.test(match[0]))
  const requestStart = requestPageBreak + 1
  if ([notificationStart, signingEnd, requestHeading, requestPageBreak, requestStart].some((index) => index < 0)
    || !(notificationStart < signingEnd && signingEnd < requestPageBreak && requestStart < requestHeading)) {
    throw new Error('Secțiunile contractului nu pot fi separate din șablon.')
  }
  const boundary = paragraphs[notificationStart - 1][0]
  const contractSection = /<w:sectPr\b[\s\S]*?<\/w:sectPr>/.exec(boundary)?.[0]
  const bodyStart = /<w:body\b[^>]*>/.exec(xml)
  const bodyEnd = xml.lastIndexOf('</w:body>')
  const finalSectionAt = xml.lastIndexOf('<w:sectPr ', bodyEnd)
  if (!contractSection || !bodyStart || finalSectionAt < 0) throw new Error('Lipsesc secțiunile Word ale documentului.')
  const finalSection = xml.slice(finalSectionAt, bodyEnd)
  const contentStart = bodyStart.index + bodyStart[0].length
  const first = part === 'contract-only' ? contentStart
    : part === 'notification-only' ? paragraphs[notificationStart].index!
      : part === 'memorandum-only' ? paragraphs[signingEnd + 1].index!
        : paragraphs[requestStart].index!
  const last = part === 'contract-only' ? paragraphs[notificationStart - 1].index!
    : part === 'notification-only' ? paragraphs[signingEnd].index!
      : part === 'memorandum-only' ? paragraphs[requestPageBreak].index!
        : finalSectionAt
  const section = part === 'contract-only' ? contractSection : finalSection
  return flattenReferenceFields(xml.slice(0, contentStart) + xml.slice(first, last) + section + xml.slice(bodyEnd))
}

function replaceReferences(xml: string, field: string, value: string) {
  const escaped = regexEscape(field)
  const pattern = new RegExp(`(<w:fldChar\\b[^>]*w:fldCharType="begin"[^>]*/>[\\s\\S]*?<w:instrText\\b[^>]*>\\s*REF\\s+${escaped}(?:\\s+[^<]*)?<\\/w:instrText>[\\s\\S]*?<w:fldChar\\b[^>]*w:fldCharType="separate"[^>]*/>)([\\s\\S]*?)(<w:fldChar\\b[^>]*w:fldCharType="end"[^>]*/>)`, 'gi')
  return xml.replace(pattern, (_match, before: string, result: string, after: string) => `${before}${replaceTextInRange(result, value)}${after}`)
}

function preserveReferenceResultStyles(xml: string) {
  return xml.replace(/(<w:instrText\b[^>]*>)([^<]*\bREF\s+[A-Za-z][^<]*)(<\/w:instrText>)/gi,
    (match, opening: string, instruction: string, closing: string) => {
      if (/\\\*\s*(?:MERGEFORMAT|CHARFORMAT)/i.test(instruction)) return match
      return `${opening}${instruction} \\* MERGEFORMAT ${closing}`
    })
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

function textRuns(paragraph: string) {
  return [...paragraph.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)]
    .map((match) => match[0]).filter((run) => /<w:t\b/.test(run))
}

function boldItalicRun(paragraph: string) {
  const run = textRuns(paragraph).find((item) => /<w:b(?:\s|\/|>)/.test(item) && /<w:i(?:\s|\/|>)/.test(item))
  if (!run) throw new Error('Șablonul nu conține stilul bold italic pentru valorile beneficiarului.')
  return run
}

// Reuse the source paragraph properties and its own italic / bold-italic runs.
// All replacement values remain inside the original paragraph and border.
function styledParagraph(paragraph: string, segments: Array<[string, string]>) {
  const opening = /^<w:p\b[^>]*>/.exec(paragraph)?.[0]
  const properties = /<w:pPr\b[\s\S]*?<\/w:pPr>/.exec(paragraph)?.[0] || ''
  if (!opening || /<w:(?:bookmarkStart|pict|fldChar)\b/.test(paragraph)) {
    throw new Error('Paragraful beneficiarului conține elemente Word care trebuie păstrate.')
  }
  return `${opening}${properties}${segments.filter(([, value]) => value).map(([run, value]) => runLike(run, value)).join('')}</w:p>`
}

function insertCnpInPhysicalNotification(paragraph: string, cnp: string) {
  const runs = textRuns(paragraph)
  const faxRun = runs.find((run) => paragraphText(run).includes(', fax'))
  if (!faxRun) throw new Error('Șablonul notificării nu conține rubrica fax.')
  const labelRun = runs.find((run) => paragraphText(run).includes('telefon')) || runs[0]
  const valueRun = boldItalicRun(paragraph)
  const insertion = `${runLike(labelRun, ', CNP ')}${runLike(valueRun, cnp)}`
  return paragraph.replace(faxRun, `${insertion}${faxRun}`)
}

function setPhysicalIdentity(paragraph: string, fields: ConnectionFields) {
  const runs = textRuns(paragraph)
  if (runs.length < 18) throw new Error('Rubrica actului de identitate s-a modificat în șablon.')
  return replaceTextRuns(paragraph, {
    0: 'având C.I. seria ', 1: fields.CiSerie.trim() || '........', 2: '',
    3: ', ', 4: 'nr.', 5: ' ', 6: '', 7: fields.CiNumar.trim() || '........',
    8: ', eliberată de ', 9: fields.CiEmisaDe.trim() || '........', 10: '', 11: '', 12: '',
    13: ', la data de ', 14: '', 15: fields.CiValabilaDeLa.trim() || '........', 16: '',
    17: ', cont nr. ........, deschis la ........, filiala ........',
  })
}

function replaceTextRuns(paragraph: string, replacements: Record<number, string>) {
  let textRun = 0
  return paragraph.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
    if (!/<w:t\b/.test(run)) return run
    const replacement = replacements[textRun++]
    return replacement === undefined ? run : runLike(run, replacement)
  })
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

// The REF sources live inside the PF box. Keep them hidden in their original
// paragraphs for PJ documents, so the surrounding paragraph and shape anchors
// retain their exact position while Word can still refresh the REF fields.
function inactivePhysicalParagraph(paragraph: string, label: string) {
  const sources = [...paragraph.matchAll(/<w:bookmarkStart\b[^>]*\/>/g)].map((match) => {
    const id = /w:id="([^"]+)"/.exec(match[0])?.[1]
    if (!id) return ''
    const end = new RegExp(`<w:bookmarkEnd\\b(?=[^>]*w:id="${regexEscape(id)}")[^>]*/>`).exec(paragraph.slice(match.index! + match[0].length))
    if (!end) return ''
    const range = paragraph.slice(match.index! + match[0].length, match.index! + match[0].length + end.index)
    const hidden = range.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
      if (/<w:rPr\b/.test(run)) return run.replace(/<w:rPr\b[^>]*>/, (opening) => `${opening}<w:vanish/>`)
      return run.replace(/^<w:r\b[^>]*>/, (opening) => `${opening}<w:rPr><w:vanish/></w:rPr>`)
    })
    return `${match[0]}${hidden}${end[0]}`
  }).join('')
  return setParagraphText(paragraph, label).replace(/<\/w:p>$/, `${sources}</w:p>`)
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
  // The original template places an explicit page break in the same paragraph
  // as the section break before the notification, producing an empty page.
  const boundary = paragraphs[notificationAddress - 1]
  if (!boundary.includes('<w:sectPr') || !/<w:br\b(?=[^>]*w:type="page")/.test(boundary)) {
    throw new Error('Limita dintre contract și notificare s-a modificat în șablon.')
  }
  changes.set(notificationAddress - 1, boundary.replace(/<w:br\b(?=[^>]*w:type="page")[^>]*\/>/, ''))
  if (getConnectionBeneficiaryType(fields) === 'PJ') {
    const legalValueRun = boldItalicRun(paragraphs[legalHeading + 2])
    const legalLine = (offset: number, segments: Array<[string, string]>) =>
      styledParagraph(paragraphs[legalHeading + offset], segments)
    const legalLabel = (offset: number) => textRuns(paragraphs[legalHeading + offset])[0]
    const valueOrDots = (value: string) => value.trim() || '........'
    changes.set(physicalHeading + 1, inactivePhysicalParagraph(paragraphs[physicalHeading + 1], 'NUME SI PRENUME –'))
    changes.set(physicalHeading + 2, inactivePhysicalParagraph(paragraphs[physicalHeading + 2], 'ADRESA DE DOMICILIU -'))
    changes.set(physicalHeading + 3, inactivePhysicalParagraph(paragraphs[physicalHeading + 3], 'Telefon –'))
    changes.set(legalHeading + 1, legalLine(1, [
      [legalLabel(1), 'DENUMIRE – '], [legalValueRun, valueOrDots(fields.Beneficiar)],
    ]))
    changes.set(legalHeading + 2, legalLine(2, [
      [legalLabel(2), 'ADRESA SEDIULUI – '], [legalValueRun, valueOrDots(fields.Oras)],
      [legalLabel(2), ', sat '], [legalValueRun, valueOrDots(fields.Sat)],
    ]))
    changes.set(legalHeading + 3, legalLine(3, [
      [legalLabel(3), 'str. '], [legalValueRun, valueOrDots(fields.Strada)],
      [legalLabel(3), ', nr. '], [legalValueRun, valueOrDots(fields.Nr)],
      [legalLabel(3), ', jud. '], [legalValueRun, valueOrDots(fields.Judet)],
    ]))
    changes.set(legalHeading + 4, legalLine(4, [
      [legalLabel(4), 'Nr. înreg. Registrul Comerțului '], [legalValueRun, valueOrDots(fields.NrRegCom)],
      [legalLabel(4), ', C.U.I./C.I.F. '], [legalValueRun, valueOrDots(fields.CUI)],
    ]))
    changes.set(legalHeading + 5, legalLine(5, [
      [legalLabel(5), 'Telefon '], [legalValueRun, valueOrDots(fields.Telefon)],
      [legalLabel(5), ' · Reprezentant legal '], [legalValueRun, valueOrDots(fields.ReprezentantLegal)],
      [legalLabel(5), ' · Funcția '], [legalValueRun, valueOrDots(fields.FunctieReprezentant)],
    ]))
    // Preserve the original applicant paragraphs and their spacing. The
    // notification's borders are Word shapes anchored to nearby paragraphs.
    const applicant = textRuns(paragraphs[legalNotification])
    const applicantValue = boldItalicRun(paragraphs[legalNotification])
    changes.set(legalNotification, styledParagraph(paragraphs[legalNotification], [
      [applicant[0], '•'], [applicant[1], 'PERSOANĂ JURIDICĂ'], [applicant[2], ': '],
      [applicantValue, valueOrDots(fields.Beneficiar)], [applicant[2], ', din '],
      [applicantValue, valueOrDots(fields.Oras)], [applicant[4], ' sat '],
      [applicantValue, valueOrDots(fields.Sat)], [applicant[6], ', cod poștal ........,'],
    ]))
    const applicantAddress = textRuns(paragraphs[legalNotification + 1])
    const addressValue = boldItalicRun(paragraphs[legalNotification + 1])
    changes.set(legalNotification + 1, styledParagraph(paragraphs[legalNotification + 1], [
      [applicantAddress[0], 'str. '], [addressValue, valueOrDots(fields.Strada)],
      [applicantAddress[0], ', nr. '], [addressValue, valueOrDots(fields.Nr)],
      [applicantAddress[0], ', județ '], [addressValue, valueOrDots(fields.Judet)],
      [applicantAddress[0], ', telefon '], [addressValue, valueOrDots(fields.Telefon)],
      [applicantAddress[0], ', fax ........, e-mail ........, cod fiscal '], [addressValue, valueOrDots(fields.CUI)],
      [applicantAddress[0], ', cont nr. ........, deschis la ........, filiala ........, nr. înreg. '],
      [addressValue, valueOrDots(fields.NrRegCom)], [applicantAddress[0], ', reprezentată prin '],
      [addressValue, valueOrDots(fields.ReprezentantLegal)], [applicantAddress[0], ', funcția '],
      [addressValue, valueOrDots(fields.FunctieReprezentant)], [applicantAddress[0], ','],
    ]))
    changes.set(physicalNotification, setNotificationApplicant(
      paragraphs[physicalNotification], '........................',
      ', domiciliat(ă) în ........, cod poștal ........, sat ........, str. ........, nr. ...., bl. ...., ap. ...., telefon ........, fax ........, e-mail ........,', true,
    ))
    changes.set(physicalNotification + 1, setParagraphText(paragraphs[physicalNotification + 1],
      'având C.I. seria ........, nr. ........, eliberată de ........, la data de ........, cont nr. ........, deschis la ........, filiala ........'))
  } else {
    if (fields.CNP.trim()) changes.set(physicalHeading + 3, appendParagraphText(paragraphs[physicalHeading + 3], ` · CNP ${fields.CNP.trim()}`))
    let applicantParagraph = replaceTextRuns(paragraphs[physicalNotification], { 0: '• ' })
    if (fields.CNP.trim()) applicantParagraph = insertCnpInPhysicalNotification(applicantParagraph, fields.CNP.trim())
    changes.set(physicalNotification, applicantParagraph)
    changes.set(physicalNotification + 1, setPhysicalIdentity(paragraphs[physicalNotification + 1], fields))
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

function a3ParagraphAtBookmark(xml: string, name: string) {
  const match = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)]
    .find((item) => new RegExp(`<w:bookmarkStart\\b(?=[^>]*w:name="${regexEscape(name)}")`).test(item[0]))
  if (!match) throw new Error(`Șablonul A3 nu conține câmpul ${name}.`)
  return { paragraph: match[0], start: match.index!, end: match.index! + match[0].length }
}

function a3ParagraphParts(paragraph: string) {
  const opening = /^<w:p\b[^>]*>/.exec(paragraph)?.[0]
  const properties = /<w:pPr\b[\s\S]*?<\/w:pPr>/.exec(paragraph)?.[0] || ''
  const textRuns = [...paragraph.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)]
    .map((match) => match[0]).filter((run) => /<w:t\b/.test(run))
  if (!opening || !textRuns.length) throw new Error('Șablonul A3 conține un paragraf necompletabil.')
  return { opening, properties, textRuns }
}

function a3BookmarkTags(paragraph: string, name: string) {
  const start = new RegExp(`<w:bookmarkStart\\b(?=[^>]*w:name="${regexEscape(name)}")(?=[^>]*w:id="([^"]+)")[^>]*/>`).exec(paragraph)
  const end = start && new RegExp(`<w:bookmarkEnd\\b(?=[^>]*w:id="${regexEscape(start[1])}")[^>]*/>`).exec(paragraph)
  if (!start || !end) throw new Error(`Șablonul A3 nu conține limitele câmpului ${name}.`)
  return { start: start[0], end: end[0] }
}

function a3AddressLines(address: string, locationNumber: string) {
  let value = address.trim().replace(/\s+/g, ' ')
  const trailingNumber = /([,]?\s*)nr\.?\s*([^,\s]+)\s*$/i.exec(value)
  const number = locationNumber.trim() || trailingNumber?.[2] || ''
  const separator = trailingNumber?.[1].includes(',') ? ', ' : ' '
  if (trailingNumber) value = value.slice(0, trailingNumber.index).trim()
  const semanticBreak = /,\s*(?=(?:sat(?:ul)?\b|str(?:ada)?\.?(?=\s)|bulevard(?:ul)?\b|bd\.?(?=\s)|calea\b|aleea\b))/i.exec(value)
  let splitAt = semanticBreak ? semanticBreak.index + 1 : -1
  if (splitAt < 0) {
    const commas = [...value.matchAll(/,\s*/g)].map((match) => match.index! + 1)
      .filter((index) => index > 0 && index < value.length - 1)
    splitAt = commas.sort((a, b) => Math.abs(a - value.length / 2) - Math.abs(b - value.length / 2))[0] ?? -1
  }
  if (splitAt < 0) {
    const middle = Math.floor(value.length / 2)
    const nextSpace = value.indexOf(' ', middle)
    splitAt = nextSpace > 0 ? nextSpace : -1
  }
  const lines = splitAt < 0 ? [value, ''] : [value.slice(0, splitAt).trim(), value.slice(splitAt).trim()]
  return [lines[0], lines[1], number, separator] as const
}

// The source A3 form is a page-sized graphic with text positioned by its
// paragraphs. Word's manually arranged examples place ATR number/date and
// work address on two separate lines, with the same original font and indents.
function positionA3Fields(xml: string, fields: ConnectionFields) {
  const contractNumber = a3ParagraphAtBookmark(xml, 'NrContract')
  xml = xml.slice(0, contractNumber.start) + replaceTextRuns(contractNumber.paragraph, { 0: '   ' }) + xml.slice(contractNumber.end)

  const beneficiary = a3ParagraphAtBookmark(xml, 'Beneficiar')
  const currentNamePadding = 65
  const padding = Math.max(1, currentNamePadding - Math.max(0, fields.Beneficiar.trim().length - 14))
  if (padding < currentNamePadding) {
    xml = xml.slice(0, beneficiary.start)
      + replaceTextRuns(beneficiary.paragraph, { 0: ' '.repeat(padding), 1: '', 2: '' })
      + xml.slice(beneficiary.end)
  }

  const atr = a3ParagraphAtBookmark(xml, 'ATR')
  const atrParts = a3ParagraphParts(atr.paragraph)
  const atrTags = a3BookmarkTags(atr.paragraph, 'ATR')
  const slash = fields.ATR.indexOf('/')
  const atrNumber = slash < 0 ? fields.ATR.trim() : fields.ATR.slice(0, slash).trim()
  const atrDate = slash < 0 ? '' : fields.ATR.slice(slash + 1).trim()
  const atrNumberParagraph = `${atrParts.opening}${atrParts.properties}${atrTags.start}${runLike(atrParts.textRuns[0], ` ${atrNumber}`)}</w:p>`
  const atrDateParagraph = `${atrParts.opening}${atrParts.properties}${runLike(atrParts.textRuns[0], `${atrDate} `)}${atrTags.end}</w:p>`
  xml = xml.slice(0, atr.start) + atrNumberParagraph + atrDateParagraph + xml.slice(atr.end)

  const location = a3ParagraphAtBookmark(xml, 'AmplasamentA3')
  const locationParts = a3ParagraphParts(location.paragraph)
  const addressTags = a3BookmarkTags(location.paragraph, 'AmplasamentA3')
  const locationNumberTags = a3BookmarkTags(location.paragraph, 'Nrloc')
  const textStyle = /<w:rPr\b[\s\S]*?<\/w:rPr>/.exec(locationParts.textRuns[0])?.[0] || ''
  const locationProperties = textStyle
    ? locationParts.properties.replace(/<w:rPr\b[\s\S]*?<\/w:rPr>/, textStyle)
    : locationParts.properties
  const [firstLine, secondLine, locationNumber, numberSeparator] = a3AddressLines(fields.AmplasamentA3, fields.Nrloc)
  const lineOne = `${locationParts.opening}${locationProperties}${addressTags.start}${runLike(locationParts.textRuns[0], ` ${firstLine}`)}</w:p>`
  const lineTwo = `${locationParts.opening}${locationProperties}${runLike(locationParts.textRuns[0], secondLine ? ` ${secondLine}` : ' ')}${addressTags.end}`
    + `${runLike(locationParts.textRuns[1] || locationParts.textRuns[0], locationNumber ? `${numberSeparator}nr.` : '')}${locationNumberTags.start}`
    + `${runLike(locationParts.textRuns.at(-1)!, locationNumber ? ` ${locationNumber} ` : '')}${locationNumberTags.end}</w:p>`
  return xml.slice(0, location.start) + lineOne + lineTwo + xml.slice(location.end)
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

export type ConnectionContractPart = 'full' | 'contract-notification' | 'contract-only' | 'notification-only' | 'memorandum-only' | 'request-only'

export async function generateConnectionDocx(fields: ConnectionFields, type: 'contract' | 'a3', part: ConnectionContractPart = 'full') {
  const filename = type === 'a3' ? 'a3-template.docx' : 'contract-template.docx'
  const buffer = await fs.readFile(path.join(process.cwd(), 'assets', 'bransamente', filename))
  const zip = new PizZip(buffer)
  const amount = parseConnectionMoney(fields.SumaFaraTVA)
  const documentFields = { ...fields, SumaFaraTVA: amount === null ? fields.SumaFaraTVA : money(amount) }
  if (getConnectionBeneficiaryType(fields) === 'PJ') {
    // These identify a natural person and must not leak from older PJ dossiers.
    for (const field of ['CNP', 'NrSX', 'DataSX', 'DataExpirareSX', 'CiSerie', 'CiNumar',
      'CiDomiciliu', 'CiEmisaDe', 'CiValabilaDeLa', 'CiValabilaPanaLa'] as const) {
      documentFields[field] = ''
    }
  }
  const xmlFiles = Object.keys(zip.files).filter((name) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(name))
  for (const name of xmlFiles) {
    let xml = zip.file(name)?.asText() || ''
    for (const field of CONNECTION_FIELDS) {
      xml = replaceBookmark(xml, field, documentFields[field] || '')
      xml = replaceReferences(xml, field, documentFields[field] || '')
    }
    if (getConnectionBeneficiaryType(fields) === 'PJ') xml = preserveReferenceResultStyles(xml)
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
    if (type === 'contract' && part !== 'full' && part !== 'contract-notification' && name === 'word/document.xml') {
      xml = keepSingleContractPart(xml, part)
    }
    if (type === 'a3' && name === 'word/document.xml') xml = positionA3Fields(xml, fields)
    zip.file(name, xml)
  }
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export function connectionDocumentName(fields: ConnectionFields, type: 'contract' | 'a3', part: ConnectionContractPart = 'full') {
  const beneficiary = (fields.Beneficiar || 'beneficiar').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  if (type === 'a3') return `Dosar-A3-${beneficiary}.docx`
  if (part === 'contract-notification') return `Contract-Notificare-${beneficiary}.docx`
  if (part === 'contract-only') return `Contract-${beneficiary}.docx`
  if (part === 'notification-only') return `Notificare-${beneficiary}.docx`
  if (part === 'memorandum-only') return `Memoriu-${beneficiary}.docx`
  if (part === 'request-only') return `Cerere-${beneficiary}.docx`
  return `Contract-Notificare-Memoriu-Cerere-${beneficiary}.docx`
}
