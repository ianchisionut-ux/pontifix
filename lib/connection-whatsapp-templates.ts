import type { ConnectionFields } from '@/lib/connection-fields'

export const CONNECTION_WHATSAPP_TEMPLATES = [
  { key: 'PROGRAMMED', label: 'Programat pentru execuție', description: 'Anunță beneficiarul că lucrarea a intrat în programare.' },
  { key: 'TAX_AUTHORITY', label: 'Achitare taxă aviz', description: 'Anunță beneficiarul că poate achita taxa la primărie.' },
  { key: 'FILE_APPROVED', label: 'Dosar aprobat', description: 'Confirmă aprobarea dosarului de branșament.' },
  { key: 'WORK_COMPLETED', label: 'Lucrare finalizată', description: 'Anunță finalizarea lucrării.' },
] as const

export type ConnectionWhatsAppTemplateKey = (typeof CONNECTION_WHATSAPP_TEMPLATES)[number]['key']

export function renderConnectionWhatsAppTemplate(key: ConnectionWhatsAppTemplateKey, data: { nib: string; fields: ConnectionFields }) {
  const beneficiary = data.fields.Beneficiar?.trim()
  const greeting = beneficiary ? `Bună ziua, ${beneficiary},` : 'Bună ziua,'
  if (key === 'PROGRAMMED') return `${greeting}\n\nBranșamentul dumneavoastră, identificat cu ${data.nib}, a fost programat pentru execuție. În zilele următoare veți fi contactat(ă) de echipa noastră pentru stabilirea detaliilor și executarea lucrării.\n\nO zi bună!\nSC ELMONT S.A.`
  if (key === 'FILE_APPROVED') return `${greeting}\n\nDosarul pentru branșamentul identificat cu ${data.nib} a fost aprobat și poate trece în etapa următoare. Vă vom ține la curent cu programarea lucrării.\n\nO zi bună!\nSC ELMONT S.A.`
  if (key === 'WORK_COMPLETED') return `${greeting}\n\nLucrarea aferentă branșamentului identificat cu ${data.nib} a fost finalizată. Vă mulțumim pentru colaborare!\n\nO zi bună!\nSC ELMONT S.A.`
  const entity = data.fields.Entitate?.trim() || 'autoritatea locală competentă'
  const authority = /^prim[ăa]ria\b/i.test(entity) ? entity : entity === 'autoritatea locală competentă' ? entity : `Primăria ${entity}`
  return `${greeting}\n\nS-a trimis pe e-mail documentația pentru obținerea avizului la ${authority}. Se poate merge la primărie pentru achitarea taxei necesare eliberării avizului.\n\nO zi bună!\nSC ELMONT S.A.`
}