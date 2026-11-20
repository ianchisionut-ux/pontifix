const BRANCHMENT = /bran[șs]ament/i
const PHASE = /\b(?:mono|tri)fazat\b/i

function clean(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

/** Use the complete work description entered in Ofertare, adding its phase only when omitted. */
export function connectionTypeFromOffer(
  offer: { serviceType?: unknown; connectionType?: unknown } | null,
  quoteServiceType?: unknown,
  atrConnectionType?: unknown,
) {
  const serviceType = [offer?.serviceType, quoteServiceType].map(clean).find((value) => BRANCHMENT.test(value)) || ''
  const phase = [offer?.connectionType, atrConnectionType].map(clean).find((value) => value === 'MONOFAZAT' || value === 'TRIFAZAT') || ''
  if (!serviceType && !phase) return ''

  let description = serviceType || 'Branșament electric'
  if (phase && !PHASE.test(description)) {
    description = /bran[șs]ament\s+electric/i.test(description)
      ? description.replace(/bran[șs]ament\s+electric/i, (match) => `${match} ${phase.toLowerCase()}`)
      : `${description} ${phase.toLowerCase()}`
  }
  return description.toLocaleUpperCase('ro-RO')
}

/** Existing hand-edited descriptions contain more than the generic type and stay untouched. */
export function isGenericConnectionType(value: unknown) {
  const description = clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  return !description || /^(?:BRANSAMENT(?: ELECTRIC)?(?: (?:MONO|TRI)FAZAT)?|(?:MONO|TRI)FAZAT)$/.test(description)
}

export function shouldReplaceGenericConnectionType(current: unknown, completeType: string) {
  const stored = clean(current)
  return Boolean(completeType) && stored !== completeType && isGenericConnectionType(stored)
    && (!PHASE.test(stored) || PHASE.test(completeType))
}
