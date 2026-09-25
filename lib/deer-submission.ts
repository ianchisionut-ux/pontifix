import { z } from 'zod'

export const DEER_CONTACT_EMAIL = 'elmont_zalau@yahoo.com'

export const DEER_ACTIONS = [
  ['completareDocumentatie', 'Completare documentație'],
  ['cerereNotificareIncheiereContractRacordare', 'Cerere / notificare încheiere contract de racordare'],
  ['alteDocumenteRacordare', 'Alte documente racordare'],
  ['incarcareDIU', 'Încărcare DIU'],
  ['incarcareInstiintareBMP', 'Încărcare înștiințare – în vederea montării BMP'],
  ['incarcareDosarReceptie', 'Încărcare dosar recepție branșament'],
  ['incarcareDosarReceptieBMP', 'Încărcare dosar recepție BMP (constructor AC)'],
  ['incarcareDosarRestituire', 'Încărcare dosar restituire'],
  ['incarcarePVProbe', 'Încărcare PV probe și PIF'],
  ['alteDocumenteCOR', 'Alte documente COR'],
  ['alteDocumenteCMI', 'Alte documente CMI'],
  ['alteDocumenteProsumator', 'Alte documente prosumator'],
] as const

export const DEER_STATUSES = ['DRAFT', 'READY', 'SUBMITTED', 'REGISTERED', 'COMPLETED'] as const

export const DEER_STATUS_META = {
  DRAFT: { label: 'Ciornă', color: '#94a3b8' },
  READY: { label: 'Pregătit pentru depunere', color: '#f59e0b' },
  SUBMITTED: { label: 'Depus', color: '#2563eb' },
  REGISTERED: { label: 'Înregistrat DEER', color: '#7c3aed' },
  COMPLETED: { label: 'Finalizat', color: '#16a34a' },
} as const

export const DEER_DOCUMENTS = ['ATR', 'Cerere', 'CI / CUI', 'Act proprietate', 'Certificat de urbanism', 'Plan de încadrare', 'Plan de situație', 'Alte documente'] as const

export const DEER_DOCUMENTS_BY_ACTION: Record<string, readonly string[]> = {
  completareDocumentatie: DEER_DOCUMENTS,
  cerereNotificareIncheiereContractRacordare: ['Cerere / notificare încheiere contract de racordare', 'Alte documente solicitate'],
  alteDocumenteRacordare: ['Alte documente racordare'],
  incarcareDIU: ['Documentație instalație de utilizare (DIU)'],
  incarcareInstiintareBMP: ['Înștiințare pentru montarea blocului de măsură și protecție'],
  incarcareDosarReceptie: ['Notificare terminare IR', 'PVRTL IR', 'Dosar IR', 'Dosar instalație de utilizare'],
  incarcareDosarReceptieBMP: ['Notificare BMP', 'Dosar recepție BMP', 'Situație de lucrări', 'PVRTL BMP'],
  incarcareDosarRestituire: ['Borderou IR', 'Factură IR', 'Dovadă plată IR', 'Proces-verbal de predare-primire', 'Document IBAN', 'Împuternicire (dacă este cazul)', 'Borderou BMP (dacă este cazul)', 'Factură BMP (dacă este cazul)', 'Cod încărcare SPV (caz NC)'],
  incarcarePVProbe: ['Proces-verbal probe', 'Proces-verbal punere în funcțiune (PIF)'],
  alteDocumenteCOR: ['Alte documente COR'],
  alteDocumenteCMI: ['Alte documente CMI'],
  alteDocumenteProsumator: ['Alte documente prosumator'],
  instiintareMontareBlocMasura: ['Înștiințare pentru montarea blocului de măsură și protecție'],
}

export function getDeerDocumentsForAction(action: string) {
  return DEER_DOCUMENTS_BY_ACTION[action as keyof typeof DEER_DOCUMENTS_BY_ACTION] || DEER_DOCUMENTS
}

export function extractDeerDossierNumber(value: string) {
  const exact = value.match(/(?<!\d)\d{13}(?!\d)/)?.[0]
  if (exact) return exact
  const labelled = value.match(/(?:ATR|solicit(?:are|ării)?(?:\s+de\s+racordare)?)[^\d]{0,30}((?:\d[\s.-]?){13})/i)?.[1]
  const digits = labelled?.replace(/\D/g, '') || ''
  return /^\d{13}$/.test(digits) ? digits : ''
}

export function isValidDeerDossierNumber(value: string) {
  return /^\d{13}$/.test(value.trim())
}

const deerActionValues: [string, ...string[]] = [
  DEER_ACTIONS[0][0],
  ...DEER_ACTIONS.slice(1).map(([value]) => value),
  'instiintareMontareBlocMasura',
]

const deerActionSchema = z.enum(deerActionValues)
const deerActionHistoryEntrySchema = z.object({ action: deerActionSchema, submittedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
export const deerSubmissionSchema = z.object({
  dossierNumber: z.string().trim().max(200).default(''),
  action: deerActionSchema.default('completareDocumentatie'),
  actionHistory: z.array(deerActionHistoryEntrySchema).max(50).default([]),
  status: z.enum(DEER_STATUSES).default('DRAFT'),
  email: z.string().trim().max(320).default(DEER_CONTACT_EMAIL),
  registrationNumber: z.string().trim().max(300).default(''),
  documents: z.array(z.string().trim().max(200)).max(30).default([]),
  submittedDocuments: z.array(z.string().trim().max(200)).max(30).default([]),
  notes: z.string().trim().max(4000).default(''),
  lastPreparedAt: z.string().datetime().nullable().default(null),
})

export type DeerSubmission = z.infer<typeof deerSubmissionSchema>

export function defaultDeerSubmission(): DeerSubmission {
  return deerSubmissionSchema.parse({ email: DEER_CONTACT_EMAIL })
}
