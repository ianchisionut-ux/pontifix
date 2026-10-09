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
    ...data.additionalTaxes.filter((tax) => tax.amount > 0).map((tax) => `• ${tax.description.trim() || 'Taxă suplimentară'}: ${formatLei(tax.amount)} (TVA ${tax.vatRate}%)`),
    '',
    `*Total ofertă (TVA inclus): ${formatLei(totals.gross)}*`,
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

export function offerEmailImageHtml(data: OfferSheetData) {
  return `<div style="margin:0;padding:20px;background:#f3f7fa;font-family:Arial,sans-serif;color:#18324a"><div style="max-width:794px;margin:0 auto"><p>Bună ziua, <strong>${escapeOfferHtml(data.customerName)}</strong>,</p><p>Vă transmitem oferta ${escapeOfferHtml(data.offerNumber)} în imaginea de mai jos. Imaginea este inclusă și ca atașament.</p><img src="cid:elmont-offer-sheet" alt="Oferta Elmont ${escapeOfferHtml(data.offerNumber)}" width="794" style="display:block;width:100%;max-width:794px;height:auto;border:0;background:#ffffff"/><p>Cu stimă,<br/>Elmont S.A.</p></div></div>`
}

