import fs from 'fs/promises'
import path from 'path'
import PizZip from 'pizzip'
import { CONNECTION_FIELDS, type ConnectionFields } from '@/lib/connection-fields'

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceTextInRange(range: string, value: string) {
  let used = false
  const replacement = xmlEscape(` ${value.trim()} `)
  return range.replace(/<w:t([^>]*)>[\s\S]*?<\/w:t>/g, (_match, attributes: string) => {
    if (used) return `<w:t${attributes}></w:t>`
    used = true
    const attrs = /xml:space=/.test(attributes) ? attributes : `${attributes} xml:space="preserve"`
    return `<w:t${attrs}>${replacement}</w:t>`
  })
}

function replaceBookmark(xml: string, field: string, value: string) {
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
  return xml.slice(0, startEnd) + replaceTextInRange(range, value) + xml.slice(absoluteEnd)
}

function replaceReferences(xml: string, field: string, value: string) {
  const escaped = regexEscape(field)
  const pattern = new RegExp(`(<w:fldChar\\b[^>]*w:fldCharType="begin"[^>]*/>[\\s\\S]*?<w:instrText\\b[^>]*>\\s*REF\\s+${escaped}(?:\\s+[^<]*)?<\\/w:instrText>[\\s\\S]*?<w:fldChar\\b[^>]*w:fldCharType="separate"[^>]*/>)([\\s\\S]*?)(<w:fldChar\\b[^>]*w:fldCharType="end"[^>]*/>)`, 'gi')
  return xml.replace(pattern, (_match, before: string, result: string, after: string) => `${before}${replaceTextInRange(result, value)}${after}`)
}

export async function generateConnectionDocx(fields: ConnectionFields, type: 'contract' | 'a3') {
  const filename = type === 'a3' ? 'a3-template.docx' : 'contract-template.docx'
  const buffer = await fs.readFile(path.join(process.cwd(), 'assets', 'bransamente', filename))
  const zip = new PizZip(buffer)
  const xmlFiles = Object.keys(zip.files).filter((name) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(name))
  for (const name of xmlFiles) {
    let xml = zip.file(name)?.asText() || ''
    for (const field of CONNECTION_FIELDS) {
      xml = replaceBookmark(xml, field, fields[field] || '')
      xml = replaceReferences(xml, field, fields[field] || '')
    }
    zip.file(name, xml)
  }
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export function connectionDocumentName(fields: ConnectionFields, type: 'contract' | 'a3') {
  const beneficiary = (fields.Beneficiar || 'beneficiar').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return type === 'a3' ? `Dosar-A3-${beneficiary}.docx` : `Contract-Notificare-Memoriu-${beneficiary}.docx`
}
