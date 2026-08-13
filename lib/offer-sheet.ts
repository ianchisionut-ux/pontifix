export type AtrOcrData = {
  customerName: string | null
  customerPhone: string | null
  workAddress: string | null
  atrNumber: string | null
  atrDate: string | null
  requestedPowerKw: string | null
  connectionType: 'MONOFAZAT' | 'TRIFAZAT' | 'NESPECIFICAT'
  confidence: number
  evidence: string | null
}

export type OfferSheetData = {
  offerNumber: string
  offerDate: string
  customerName: string
  customerPhone: string
  customerEmail: string
  workLocation: string
  serviceType: string
  connectionType: 'MONOFAZAT' | 'TRIFAZAT' | 'NESPECIFICAT'
  executionNet: number
  reimbursement: string
  projectNet: number
  panelIncluded: boolean
  panelDescription: string
  panelNet: number
  vatRate: number
  validity: string
  executionTerm: string
  paymentTerms: string
  customerDetails: string
  offerNotes: string
}

export type OfferFallback = {
  id: string
  name: string
  phone: string
  email: string
  location: string | null
  serviceType: string
  message: string | null
  createdAt?: Date | string
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function amount(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

export function makeOfferNumber(offer: Pick<OfferFallback, 'id' | 'createdAt'>) {
  const date = offer.createdAt ? new Date(offer.createdAt) : new Date()
  return `ELM-${date.getFullYear()}-${offer.id.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()}`
}

export function defaultOfferSheet(offer: OfferFallback, ocr?: AtrOcrData | null): OfferSheetData {
  const created = offer.createdAt ? new Date(offer.createdAt) : new Date()
  return {
    offerNumber: makeOfferNumber(offer),
    offerDate: Number.isNaN(created.getTime()) ? new Date().toISOString().slice(0, 10) : created.toISOString().slice(0, 10),
    customerName: ocr?.customerName || offer.name,
    customerPhone: ocr?.customerPhone || offer.phone,
    customerEmail: offer.email,
    workLocation: ocr?.workAddress || offer.location || '',
    serviceType: offer.serviceType,
    connectionType: ocr?.connectionType || 'NESPECIFICAT',
    executionNet: 0,
    reimbursement: '',
    projectNet: 0,
    panelIncluded: false,
    panelDescription: 'Tablou electric monofazat/trifazat pe suport zincat la limita de proprietate',
    panelNet: 0,
    vatRate: 21,
    validity: '30 de zile',
    executionTerm: 'Conform programării stabilite după acceptarea ofertei',
    paymentTerms: 'Conform contractului / comenzii acceptate',
    customerDetails: offer.message || '',
    offerNotes: '',
  }
}

export function normalizeOfferSheet(value: unknown, fallback: OfferFallback, ocr?: AtrOcrData | null): OfferSheetData {
  const defaults = defaultOfferSheet(fallback, ocr)
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const connectionType = input.connectionType === 'MONOFAZAT' || input.connectionType === 'TRIFAZAT' ? input.connectionType : defaults.connectionType
  return {
    offerNumber: text(input.offerNumber, defaults.offerNumber),
    offerDate: text(input.offerDate, defaults.offerDate),
    customerName: text(input.customerName, defaults.customerName),
    customerPhone: text(input.customerPhone, defaults.customerPhone),
    customerEmail: text(input.customerEmail, defaults.customerEmail),
    workLocation: text(input.workLocation, defaults.workLocation),
    serviceType: text(input.serviceType, defaults.serviceType),
    connectionType,
    executionNet: amount(input.executionNet),
    reimbursement: text(input.reimbursement),
    projectNet: amount(input.projectNet),
    panelIncluded: typeof input.panelIncluded === 'boolean' ? input.panelIncluded : defaults.panelIncluded,
    panelDescription: text(input.panelDescription, defaults.panelDescription),
    panelNet: amount(input.panelNet),
    vatRate: Math.min(100, amount(input.vatRate, defaults.vatRate)),
    validity: text(input.validity, defaults.validity),
    executionTerm: text(input.executionTerm, defaults.executionTerm),
    paymentTerms: text(input.paymentTerms, defaults.paymentTerms),
    customerDetails: text(input.customerDetails, defaults.customerDetails),
    offerNotes: text(input.offerNotes),
  }
}

export function offerTotals(offer: OfferSheetData) {
  const net = offer.executionNet + offer.projectNet + (offer.panelIncluded ? offer.panelNet : 0)
  const vat = net * offer.vatRate / 100
  return { net, vat, gross: net + vat }
}

export function formatLei(value: number) {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', minimumFractionDigits: 2 }).format(value)
}

