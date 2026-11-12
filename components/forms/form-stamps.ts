import type { StampPlacement } from '@/lib/ensure-form-storage'

export const BENEFICIARY_SIGNED_KEY = '__beneficiary_signed_this_document'

export function beneficiarySigned(values?: Record<string, string>) {
  return values?.[BENEFICIARY_SIGNED_KEY] === 'yes'
}

export function effectiveStampPlacements(template: StampPlacement[], submission?: StampPlacement[]) {
  if (!submission) return template
  const overrides = new Map(submission.map((item) => [item.id, item]))
  return [
    ...template.map((item) => overrides.get(item.id) || item),
    ...submission.filter((item) => !template.some((model) => model.id === item.id)),
  ]
}
