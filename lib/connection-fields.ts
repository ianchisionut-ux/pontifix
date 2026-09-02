import { z } from 'zod'

export const CONNECTION_FIELD_GROUPS = [
  { title: 'Identificare', fields: ['Beneficiar', 'CnpCif', 'Telefon', 'Entitate'] },
  { title: 'Adresă', fields: ['Judet', 'Oras', 'Sat', 'Strada', 'Nr', 'Nrloc', 'Bloc', 'Ap'] },
  { title: 'Amplasament', fields: ['Amplasament', 'AmplasamentA3', 'NrCad'] },
  { title: 'ATR / Branșament', fields: ['ATR', 'TipBransament', 'PTA', 'Solutia'] },
  { title: 'Puteri', fields: ['KW', 'KW2', 'KVA'] },
  { title: 'Contract / Altele', fields: ['SumaFaraTVA', 'NrContract', 'DATA', 'NrSX', 'DataSX', 'DataExpirareSX'] },
] as const

export const CONNECTION_FIELD_LABELS: Record<string, string> = {
  Beneficiar: 'Beneficiar', CnpCif: 'CNP / CIF', Telefon: 'Telefon', Entitate: 'Entitate / UAT',
  Judet: 'Județ', Oras: 'Oraș', Sat: 'Localitate / sat', Strada: 'Strada', Nr: 'Număr',
  Nrloc: 'Număr loc consum', Bloc: 'Bloc', Ap: 'Apartament', Amplasament: 'Amplasament complet',
  AmplasamentA3: 'Amplasament dosar A3', NrCad: 'NR. CAD', ATR: 'Număr / dată ATR', TipBransament: 'Tip branșament',
  PTA: 'PTA / sursa de alimentare', Solutia: 'Soluția tehnică', KW: 'Putere (kW)', KW2: 'Putere A3 (kW)',
  KVA: 'Putere (kVA)', SumaFaraTVA: 'Sumă fără TVA', NrContract: 'Număr contract',
  DATA: 'Data contractului', NrSX: 'Număr SX', DataSX: 'Data SX', DataExpirareSX: 'Data expirare SX',
  CiSerie: 'Serie CI', CiNumar: 'Număr CI', CiDomiciliu: 'Domiciliu CI', CiEmisaDe: 'CI emisă de',
  CiValabilaDeLa: 'CI valabilă de la', CiValabilaPanaLa: 'CI valabilă până la',
}

export const CONNECTION_EXTRA_FIELDS = ['CiSerie', 'CiNumar', 'CiDomiciliu', 'CiEmisaDe', 'CiValabilaDeLa', 'CiValabilaPanaLa'] as const
export const CONNECTION_FIELDS = [...CONNECTION_FIELD_GROUPS.flatMap((group) => [...group.fields]), ...CONNECTION_EXTRA_FIELDS]

export type ConnectionFields = Record<(typeof CONNECTION_FIELDS)[number], string>

export function defaultConnectionFields(): ConnectionFields {
  return {
    Beneficiar: '', CnpCif: '', Telefon: '', Entitate: 'Mun. Zalău', Judet: 'Sălaj', Oras: 'Zalău', Sat: '',
    Strada: '', Nr: '', Nrloc: '', Bloc: '', Ap: '', Amplasament: '', AmplasamentA3: 'Jud. Sălaj, ', NrCad: '',
    ATR: '', PTA: '', Solutia: '', SumaFaraTVA: '', NrContract: '',
    DATA: new Date().toLocaleDateString('ro-RO'), KW: '05.00 KW', KW2: '05.00', KVA: '05.56 kVA',
    TipBransament: 'BRANȘAMENT ELECTRIC TRIFAZAT', NrSX: '', DataSX: '', DataExpirareSX: '',
    CiSerie: '', CiNumar: '', CiDomiciliu: '', CiEmisaDe: '', CiValabilaDeLa: '', CiValabilaPanaLa: '',
  }
}

export const connectionFieldsSchema = z.record(z.string(), z.string().trim().max(4000)).transform((input) => {
  const defaults = defaultConnectionFields()
  for (const field of CONNECTION_FIELDS) defaults[field] = input[field] ?? defaults[field]
  return defaults
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
