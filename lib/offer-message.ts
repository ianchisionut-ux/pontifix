import type { OfferSheetData } from '@/lib/offer-sheet'
import { formatLei, offerTotals } from '@/lib/offer-sheet'

export function offerText(data: OfferSheetData) {
  const totals = offerTotals(data)
  const lines = [
    '*OFERTĂ ELMONT S.A.*',
    `Nr. ${data.offerNumber} din ${new Date(data.offerDate).toLocaleDateString('ro-RO')}`,
    '',
    `Bună ziua, ${data.customerName}!`,
    `Vă transmitem oferta pentru ${data.serviceType.toLocaleLowerCase('ro-RO')}.`,
    data.workLocation ? `Locul lucrării: ${data.workLocation}` : '',
    '',
    data.executionNet ? `• Execuție branșament: ${formatLei(data.executionNet)} + TVA` : '',
    data.reimbursement ? `  Ramburs estimat: ${data.reimbursement}` : '',
    data.projectNet ? `• Proiect / documentație: ${formatLei(data.projectNet)} + TVA` : '',
    data.panelIncluded && data.panelNet ? `• ${data.panelDescription}: ${formatLei(data.panelNet)} + TVA` : '',
    '',
    `*Total cu TVA (${data.vatRate}%): ${formatLei(totals.gross)}*`,
    `Valabilitate: ${data.validity}`,
    `Termen: ${data.executionTerm}`,
    data.offerNotes ? `Observații: ${data.offerNotes}` : '',
    '',
    'Pentru acceptare sau clarificări, ne puteți răspunde direct la acest mesaj.',
    '— Elmont S.A. · Zalău',
  ]
  return lines.filter((line, index, all) => line || all[index - 1] !== '').join('\n').slice(0, 4000)
}

export function escapeOfferHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character)
}

export function offerEmailHtml(data: OfferSheetData) {
  const totals = offerTotals(data)
  const row = (label: string, net: number) => net ? `<tr><td style="padding:12px;border-bottom:1px solid #dbe6ef">${escapeOfferHtml(label)}</td><td style="padding:12px;border-bottom:1px solid #dbe6ef;text-align:right;font-weight:700">${escapeOfferHtml(formatLei(net))} + TVA</td></tr>` : ''
  return `<div style="background:#f3f7fa;padding:28px;font-family:Arial,sans-serif;color:#18324a"><div style="max-width:720px;margin:auto;background:white;border-radius:18px;overflow:hidden;border:1px solid #dbe6ef"><div style="padding:26px;background:linear-gradient(135deg,#0d5d8b,#2f91c8);color:white"><h1 style="margin:0;font-size:27px">ELMONT S.A.</h1><p style="margin:6px 0 0">Ofertă ${escapeOfferHtml(data.offerNumber)} · ${new Date(data.offerDate).toLocaleDateString('ro-RO')}</p></div><div style="padding:26px"><p>Bună ziua, <strong>${escapeOfferHtml(data.customerName)}</strong>,</p><p>Vă transmitem oferta pentru <strong>${escapeOfferHtml(data.serviceType)}</strong>${data.workLocation ? `, la ${escapeOfferHtml(data.workLocation)}` : ''}.</p><table style="width:100%;border-collapse:collapse;margin:22px 0">${row('Execuție branșament', data.executionNet)}${row('Proiect / documentație', data.projectNet)}${data.panelIncluded ? row(data.panelDescription, data.panelNet) : ''}<tr><td style="padding:15px;background:#e8f4fa;font-weight:700">Total cu TVA (${data.vatRate}%)</td><td style="padding:15px;background:#e8f4fa;text-align:right;font-size:18px;font-weight:800;color:#0d5d8b">${escapeOfferHtml(formatLei(totals.gross))}</td></tr></table>${data.reimbursement ? `<p><strong>Ramburs estimat:</strong> ${escapeOfferHtml(data.reimbursement)}</p>` : ''}<p><strong>Valabilitate:</strong> ${escapeOfferHtml(data.validity)}</p><p><strong>Termen:</strong> ${escapeOfferHtml(data.executionTerm)}</p><p><strong>Condiții de plată:</strong> ${escapeOfferHtml(data.paymentTerms)}</p>${data.offerNotes ? `<p><strong>Observații:</strong> ${escapeOfferHtml(data.offerNotes)}</p>` : ''}<p style="margin-top:26px">Cu stimă,<br><strong>Elmont S.A.</strong><br>Str. 22 Decembrie 1989, nr. 113, Zalău</p></div></div></div>`
}

