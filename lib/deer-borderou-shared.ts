export type DeerBorderouDto = {
  id: string
  connectionId: string | null
  documentName: string
  source: string
  sender: string | null
  subject: string | null
  dossierNumber: string | null
  beneficiary: string | null
  receivedAt: string
}

export function isBorderouTemplate(title: string) {
  return /\bborderou\b/i.test(title)
}
