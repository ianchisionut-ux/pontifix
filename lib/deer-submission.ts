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
