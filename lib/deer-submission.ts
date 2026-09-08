import { z } from 'zod'

export const DEER_ACTIONS = [
  ['completareDocumentatie', 'Completare documentație'],
  ['incarcareDIU', 'Încărcare documentație instalație utilizare'],
  ['incarcareInstiintareBMP', 'Înștiințare bloc de măsură și protecție'],
  ['cerereNotificareIncheiereContractRacordare', 'Cerere / notificare încheiere contract de racordare'],
  ['incarcareDosarReceptie', 'Încărcare dosar recepție'],
  ['incarcarePVProbe', 'Încărcare proces-verbal probe'],
  ['incarcareDosarRestituire', 'Încărcare dosar restituire'],
  ['incarcareDosarReceptieBMP', 'Încărcare dosar recepție BMP'],
  ['alteDocumenteRacordare', 'Alte documente racordare'],
  ['alteDocumenteCOR', 'Alte documente COR'],
  ['alteDocumenteCMI', 'Alte documente CMI'],
  ['instiintareMontareBlocMasura', 'Înștiințare montare bloc de măsură'],
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

export const DEER_DOCUMENTS_BY_ACTION: Record<(typeof DEER_ACTIONS)[number][0], readonly string[]> = {
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

const deerActionValues = DEER_ACTIONS.map(([value]) => value) as [string, ...string[]]

export const deerSubmissionSchema = z.object({
  dossierNumber: z.string().trim().max(200).default(''),
  action: z.enum(deerActionValues).default('completareDocumentatie'),
  status: z.enum(DEER_STATUSES).default('DRAFT'),
  email: z.string().trim().max(320).default(''),
  registrationNumber: z.string().trim().max(300).default(''),
  documents: z.array(z.string().trim().max(200)).max(30).default([]),
  notes: z.string().trim().max(4000).default(''),
  lastPreparedAt: z.string().datetime().nullable().default(null),
})

export type DeerSubmission = z.infer<typeof deerSubmissionSchema>

export function defaultDeerSubmission(): DeerSubmission {
  return deerSubmissionSchema.parse({})
}
