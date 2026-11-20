import { z } from 'zod'

export const CONNECTION_FIELD_GROUPS = [
  { title: 'Identificare', fields: ['TipBeneficiar', 'Beneficiar', 'CNP', 'CUI', 'Telefon', 'Entitate', 'NrRegCom', 'ReprezentantLegal', 'FunctieReprezentant'] },
  { title: 'Adresă', fields: ['Judet', 'Oras', 'Sat', 'Strada', 'Nr', 'Nrloc', 'Bloc', 'Ap'] },
  { title: 'Amplasament', fields: ['Amplasament', 'AmplasamentA3', 'NrCad'] },
  { title: 'ATR / Branșament', fields: ['ATR', 'TipBransament', 'PTA', 'Solutia'] },
  { title: 'Puteri', fields: ['KW', 'KW2', 'KVA'] },
  { title: 'Contract / Altele', fields: ['SumaFaraTVA', 'NrContract', 'DATA', 'NrSX', 'DataSX', 'DataExpirareSX'] },
] as const

export const CONNECTION_FIELD_LABELS: Record<string, string> = {
  TipBeneficiar: 'Tip beneficiar', Beneficiar: 'Beneficiar', CNP: 'CNP', CUI: 'CUI / CIF', CnpCif: 'CNP / CIF',
  Telefon: 'Telefon', Entitate: 'Entitate / UAT', NrRegCom: 'Nr. Registrul Comerțului',
  ReprezentantLegal: 'Reprezentant legal', FunctieReprezentant: 'Funcția reprezentantului',
  Judet: 'Județ', Oras: 'Oraș', Sat: 'Localitate / sat', Strada: 'Strada', Nr: 'Număr',
  Nrloc: 'Număr loc consum', Bloc: 'Bloc', Ap: 'Apartament', Amplasament: 'Amplasament complet',
  AmplasamentA3: 'Amplasament dosar A3', NrCad: 'NR. CAD', ATR: 'Număr / dată ATR', TipBransament: 'Tip branșament',
  PTA: 'PTA / sursa de alimentare', Solutia: 'Soluția tehnică', KW: 'Putere (kW)', KW2: 'Putere A3 (kW)',
  KVA: 'Putere (kVA)', SumaFaraTVA: 'Sumă fără TVA', NrContract: 'Număr contract',
  DATA: 'Data contractului', NrSX: 'Număr SX', DataSX: 'Data SX', DataExpirareSX: 'Data expirare SX',
  CiSerie: 'Serie CI', CiNumar: 'Număr CI', CiDomiciliu: 'Domiciliu CI', CiEmisaDe: 'CI emisă de',
  CiValabilaDeLa: 'CI valabilă de la', CiValabilaPanaLa: 'CI valabilă până la',
}

export const CONNECTION_EXTRA_FIELDS = ['CnpCif', 'CiSerie', 'CiNumar', 'CiDomiciliu', 'CiEmisaDe', 'CiValabilaDeLa', 'CiValabilaPanaLa'] as const
export const CONNECTION_FIELDS = [...CONNECTION_FIELD_GROUPS.flatMap((group) => [...group.fields]), ...CONNECTION_EXTRA_FIELDS]

export type ConnectionFields = Record<(typeof CONNECTION_FIELDS)[number], string>
export type ConnectionBeneficiaryType = 'PF' | 'PJ'

const legalBeneficiaryName = /^(?:S\.?C\.?\s|S\.?R\.?L\.?\b|S\.?A\.?\b|PFA\b|II\b|IF\b|PAROHIA\b|BISERICA\b|COMUNA\b|MUNICIPIUL\b|ORASUL\b|ORAȘUL\b|PRIMARIA\b|PRIMĂRIA\b|ASOCIATIA\b|ASOCIAȚIA\b|FUNDATIA\b|FUNDAȚIA\b|SCOALA\b|ȘCOALA\b|LICEUL\b|SPITALUL\b|UNIVERSITATEA\b|COMPANIA\b|REGIA\b)/i

function identifierType(value: string): ConnectionBeneficiaryType | null {
  const cleaned = value.trim()
  const digits = cleaned.replace(/\D/g, '')
  if (!digits) return null
  if (/\bCNP\b|COD\s+NUMERIC\s+PERSONAL/i.test(cleaned)) return 'PF'
  if (/\bCUI\b|\bCIF\b|COD\s+FISCAL/i.test(cleaned)) return 'PJ'
  if (digits.length === 13) return 'PF'
  if (digits.length >= 2 && digits.length <= 10) return 'PJ'
  return null
}

export function getConnectionBeneficiaryType(fields: Partial<Record<string, string>>): ConnectionBeneficiaryType {
  if (fields.TipBeneficiar === 'PF' || fields.TipBeneficiar === 'PJ') return fields.TipBeneficiar
  if (fields.CUI?.trim()) return 'PJ'
  if (fields.CNP?.trim()) return 'PF'
  return identifierType(fields.CnpCif || '') || (legalBeneficiaryName.test(fields.Beneficiar || '') ? 'PJ' : 'PF')
}

export function normalizeConnectionBeneficiaryFields(input: Partial<Record<string, string>>): ConnectionFields {
  const fields = { ...defaultConnectionFields(), ...input }
  const type = getConnectionBeneficiaryType(input)
  const legacyId = input.CnpCif?.trim() || ''
  fields.TipBeneficiar = type
  const hasNewIdentifier = Boolean(input.CNP?.trim() || input.CUI?.trim())
  if (legacyId && (!hasNewIdentifier || identifierType(legacyId) === type)) {
    if (type === 'PF' && !fields.CNP.trim()) fields.CNP = legacyId
    if (type === 'PJ' && !fields.CUI.trim()) fields.CUI = legacyId
  }
  // Existing offer/DEER matching still reads CnpCif. Keep it in sync with the selected type.
  fields.CnpCif = type === 'PF' ? fields.CNP : fields.CUI
  return fields
}

export function defaultConnectionFields(): ConnectionFields {
  return {
    TipBeneficiar: 'PF', Beneficiar: '', CNP: '', CUI: '', CnpCif: '', Telefon: '', Entitate: 'Mun. Zalău',
    NrRegCom: '', ReprezentantLegal: '', FunctieReprezentant: '', Judet: 'Sălaj', Oras: 'Zalău', Sat: '',
    Strada: '', Nr: '', Nrloc: '', Bloc: '', Ap: '', Amplasament: '', AmplasamentA3: 'Jud. Sălaj, ', NrCad: '',
    ATR: '', PTA: '', Solutia: '', SumaFaraTVA: '', NrContract: '',
    DATA: new Date().toLocaleDateString('ro-RO'), KW: '05.00 KW', KW2: '05.00', KVA: '05.56 kVA',
    TipBransament: 'BRANȘAMENT ELECTRIC TRIFAZAT', NrSX: '', DataSX: '', DataExpirareSX: '',
    CiSerie: '', CiNumar: '', CiDomiciliu: '', CiEmisaDe: '', CiValabilaDeLa: '', CiValabilaPanaLa: '',
  }
}

export const connectionFieldsSchema = z.record(z.string(), z.string().trim().max(4000)).transform((input) => {
  const known = Object.fromEntries(CONNECTION_FIELDS.filter((field) => input[field] !== undefined).map((field) => [field, input[field]]))
  return normalizeConnectionBeneficiaryFields(known)
})

export type ConnectionCaseDto = {
  id: string
  sequenceNumber: number
  nib: string
  status: import('@/lib/connection-status').ConnectionStatus
  quoteRequestId: string | null
  deerSubmittedAt: string | null
  deerSubmission: import('@/lib/deer-submission').DeerSubmission
  fields: ConnectionFields
  atrPathname: string | null
  atrName: string | null
  createdByEmail: string | null
  createdAt: string
  updatedAt: string
}
