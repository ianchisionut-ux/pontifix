export const DEER_DOCUMENT_KINDS = ['BORDEROU', 'PV_PREDARE_PRIMIRE', 'INSTIINTARE_BMP'] as const
export type DeerDocumentKind = typeof DEER_DOCUMENT_KINDS[number]
export const DEER_DOCUMENT_LABELS: Record<DeerDocumentKind, string> = {
  BORDEROU: 'Borderou DEER',
  PV_PREDARE_PRIMIRE: 'PV predare-primire',
  INSTIINTARE_BMP: 'Înștiințare montare BMP',
}

export function deerDocumentKindFromName(name: string): DeerDocumentKind | null {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/\bborderou\b|dinv900/.test(normalized)) return 'BORDEROU'
  if (/predare[\s_-]*primire|dinv901/.test(normalized)) return 'PV_PREDARE_PRIMIRE'
  if (/instiintare.*(?:montare|bmp)|montare.*bmp|dinv906/.test(normalized)) return 'INSTIINTARE_BMP'
  return null
}

export function deerDocumentKindForTemplate(template: { category: string; title: string; documentName: string; deerDocumentKind?: DeerDocumentKind | null }): DeerDocumentKind | null {
  return template.category === 'DEER' ? template.deerDocumentKind || deerDocumentKindFromName(template.title) || deerDocumentKindFromName(template.documentName) : null
}

export type DeerBorderouDto = {
  id: string
  connectionId: string | null
  documentKind: DeerDocumentKind
  documentName: string
  source: string
  sender: string | null
  subject: string | null
  dossierNumber: string | null
  beneficiary: string | null
  receivedAt: string
}
