import path from 'path'
import PDFDocument from 'pdfkit'
import { formatLei, offerTotals, type OfferSheetData } from '@/lib/offer-sheet'

const BLUE = '#0d5d8b'
const DARK = '#082b4d'
const ACCENT = '#2f91c8'
const MUTED = '#64748b'
const PALE = '#edf7fc'
const BORDER = '#cfdae3'

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'oferta'
}

export function offerPdfFilename(data: OfferSheetData) {
  return `Oferta-Elmont-${safeFilePart(data.offerNumber)}.pdf`
}

export async function generateOfferPdf(data: OfferSheetData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 42, info: {
    Title: `Oferta Elmont ${data.offerNumber}`,
    Author: 'ELMONT S.A.',
    Subject: data.serviceType,
  } })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const regular = path.join(process.cwd(), 'public', 'fonts', 'noto-sans-regular.ttf')
  const bold = path.join(process.cwd(), 'public', 'fonts', 'noto-sans-bold.ttf')
  doc.registerFont('Noto', regular)
  doc.registerFont('Noto Bold', bold)
  doc.font('Noto')

  const pageWidth = doc.page.width
  const left = doc.page.margins.left
  const right = pageWidth - doc.page.margins.right
  const width = right - left

  try {
    doc.image(path.join(process.cwd(), 'public', 'elmont-logo.png'), left, 34, { fit: [86, 58] })
  } catch {
    // Denumirea companiei rămâne vizibilă chiar dacă imaginea nu poate fi citită.
  }
  doc.font('Noto Bold').fontSize(18).fillColor(DARK).text('ELMONT S.A.', left + 96, 40)
  doc.font('Noto').fontSize(8.5).fillColor(MUTED).text('Proiectare și execuție instalații electrice', left + 96, 64)
  doc.text('CUI 9710508 · J1997000155315', left + 96, 78)

  doc.font('Noto Bold').fontSize(20).fillColor(ACCENT).text('OFERTĂ', right - 145, 38, { width: 145, align: 'right' })
  doc.fontSize(9).fillColor(DARK).text(`Nr. ${data.offerNumber}`, right - 180, 65, { width: 180, align: 'right' })
  doc.font('Noto').fontSize(8).fillColor(MUTED).text(new Date(data.offerDate).toLocaleDateString('ro-RO'), right - 180, 80, { width: 180, align: 'right' })
  doc.moveTo(left, 101).lineTo(right, 101).lineWidth(3).strokeColor(ACCENT).stroke()

  doc.roundedRect(left, 118, width, 62, 9).fill(BLUE)
  doc.font('Noto Bold').fontSize(16).fillColor('#ffffff').text(data.serviceType.toUpperCase(), left + 18, 133, { width: width - 36 })
  doc.font('Noto').fontSize(8).fillColor('#dff3fc').text('Fișă tehnico-economică pentru beneficiar', left + 18, 158)

  doc.roundedRect(left, 194, width, 70, 8).fillAndStroke('#f5fafc', '#cfe2ed')
  doc.font('Noto Bold').fontSize(7).fillColor(ACCENT).text('BENEFICIAR', left + 16, 207)
  doc.fontSize(11).fillColor(DARK).text(data.customerName || '—', left + 16, 222, { width: width / 2 - 28 })
  doc.font('Noto').fontSize(8).fillColor(MUTED).text(`${data.customerPhone || '—'} · ${data.customerEmail || '—'}`, left + 16, 242, { width: width / 2 - 28 })
  doc.font('Noto Bold').fontSize(7).fillColor(ACCENT).text('LOCUL LUCRĂRII', left + width / 2 + 10, 207)
  doc.fontSize(10).fillColor(DARK).text(data.workLocation || '—', left + width / 2 + 10, 224, { width: width / 2 - 26 })

  let y = 284
  doc.font('Noto Bold').fontSize(10).fillColor(BLUE).text('OBIECTUL OFERTEI', left, y)
  y += 18
  doc.font('Noto').fontSize(8.5).fillColor(DARK).text('Elmont S.A. propune realizarea serviciilor de proiectare și/sau execuție pentru obiectivul descris, pe baza datelor furnizate de beneficiar și a documentației ATR disponibile.', left, y, { width, lineGap: 2 })
  y = doc.y + 13

  if (data.customerDetails) {
    const detailHeight = Math.min(54, doc.heightOfString(data.customerDetails, { width: width - 24 }) + 18)
    doc.roundedRect(left, y, width, detailHeight, 5).fill(PALE)
    doc.rect(left, y, 4, detailHeight).fill(ACCENT)
    doc.font('Noto').fontSize(8).fillColor(DARK).text(data.customerDetails, left + 14, y + 9, { width: width - 26, height: detailHeight - 16, ellipsis: true })
    y += detailHeight + 14
  }

  doc.font('Noto Bold').fontSize(10).fillColor(BLUE).text('STRUCTURA OFERTEI', left, y)
  y += 20
  const cols = [34, width - 286, 92, 72, 88]
  const xs = [left]
  for (let index = 0; index < cols.length - 1; index++) xs.push(xs[index] + cols[index])
  const tableRow = (values: string[], rowHeight: number, fill?: string, color = DARK, boldRow = false) => {
    if (fill) doc.rect(left, y, width, rowHeight).fill(fill)
    doc.rect(left, y, width, rowHeight).lineWidth(.6).strokeColor(BORDER).stroke()
    for (let index = 1; index < xs.length; index++) doc.moveTo(xs[index], y).lineTo(xs[index], y + rowHeight).stroke()
    doc.font(boldRow ? 'Noto Bold' : 'Noto').fontSize(7.4).fillColor(color)
    values.forEach((value, index) => doc.text(value, xs[index] + 5, y + 8, { width: cols[index] - 10, align: index >= 2 ? 'right' : index === 0 ? 'center' : 'left', lineBreak: false, ellipsis: true }))
    y += rowHeight
  }
  tableRow(['Nr.', 'Serviciu / lucrare', 'Fără TVA', 'TVA', 'Total'], 27, BLUE, '#ffffff', true)
  const priceRows: Array<[string, string, number]> = []
  if (data.executionNet > 0) priceRows.push(['1', 'Execuție branșament electric', data.executionNet])
  if (data.projectNet > 0) priceRows.push([String(priceRows.length + 1), 'Proiect / documentație', data.projectNet])
  if (data.panelIncluded && data.panelNet > 0) priceRows.push([String(priceRows.length + 1), data.panelDescription, data.panelNet])
  if (!priceRows.length) tableRow(['—', 'Valorile se completează de ofertant', '—', `${data.vatRate}%`, '—'], 29)
  for (const [nr, label, net] of priceRows) {
    const vat = net * data.vatRate / 100
    tableRow([nr, label, formatLei(net), formatLei(vat), formatLei(net + vat)], 29)
  }
  const totals = offerTotals(data)
  tableRow(['', 'TOTAL OFERTĂ', formatLei(totals.net), formatLei(totals.vat), formatLei(totals.gross)], 32, '#e4f2f8', DARK, true)
  if (data.reimbursement) {
    doc.font('Noto Bold').fontSize(8).fillColor(BLUE).text(`Ramburs estimat: ${data.reimbursement}`, left, y + 7, { width, align: 'right' })
    y += 23
  } else y += 13

  doc.font('Noto Bold').fontSize(10).fillColor(BLUE).text('CONDIȚII COMERCIALE', left, y)
  y += 20
  const gap = 8
  const boxWidth = (width - gap * 2) / 3
  const conditions = [
    ['VALABILITATE', data.validity],
    ['TERMEN DE EXECUȚIE', data.executionTerm],
    ['CONDIȚII DE PLATĂ', data.paymentTerms],
  ]
  conditions.forEach(([label, value], index) => {
    const x = left + index * (boxWidth + gap)
    doc.roundedRect(x, y, boxWidth, 58, 5).fill('#f4f7f9')
    doc.font('Noto Bold').fontSize(6.5).fillColor(ACCENT).text(label, x + 9, y + 9, { width: boxWidth - 18 })
    doc.font('Noto Bold').fontSize(7.5).fillColor(DARK).text(value, x + 9, y + 25, { width: boxWidth - 18, height: 25, ellipsis: true })
  })
  y += 72

  if (data.offerNotes && y < 690) {
    doc.font('Noto Bold').fontSize(9).fillColor(BLUE).text('OBSERVAȚII', left, y)
    y += 16
    doc.font('Noto').fontSize(7.5).fillColor(DARK).text(data.offerNotes, left, y, { width, height: 45, ellipsis: true })
  }

  const footerY = doc.page.height - 92
  doc.moveTo(left, footerY).lineTo(right, footerY).lineWidth(.7).strokeColor('#a9bac8').stroke()
  doc.font('Noto Bold').fontSize(8).fillColor(DARK).text('ELMONT S.A.', left, footerY + 12)
  doc.font('Noto').fontSize(6.8).fillColor(MUTED).text('Str. 22 Decembrie 1989, nr. 113, Zalău, Sălaj · 0260 611 133', left, footerY + 27)
  doc.fontSize(6.5).text('Lucrări de construcții pentru electricitate și telecomunicații', left, footerY + 39)
  doc.font('Noto').fontSize(7).fillColor(MUTED).text('Întocmit,', right - 205, footerY + 12, { width: 90, align: 'center' })
  doc.text('Acceptat beneficiar,', right - 100, footerY + 12, { width: 100, align: 'center' })
  doc.moveTo(right - 205, footerY + 52).lineTo(right - 115, footerY + 52).stroke()
  doc.moveTo(right - 100, footerY + 52).lineTo(right, footerY + 52).stroke()

  doc.end()
  return finished
}
