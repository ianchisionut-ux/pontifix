import { z } from 'zod'

const text = z.string().trim()
export const clientSchema = z.object({
  name: text.min(1, 'Completează denumirea sau numele clientului.'),
  clientType: z.enum(['PF', 'PJ']).default('PJ'),
  cif: text.default(''),
  regCom: text.default(''),
  cnp: text.default(''),
  phone: text.default(''),
  postalCode: text.default(''),
  ciSeries: text.default(''),
  ciNumber: text.default(''),
  vatPayer: z.union([z.number().int().min(0).max(1), z.boolean()]).default(0).transform(Number),
  sourceConnectionId: text.nullable().optional(),
  sourceNib: text.optional(),
  address: text.min(1, 'Completează adresa clientului.'),
  judet: text.min(1, 'Completează județul / regiunea clientului.'),
  city: text.min(1, 'Completează localitatea clientului.'),
  countryCode: text.regex(/^[A-Za-z]{2}$/, 'Introdu codul țării din două litere.').transform(value => value.toUpperCase()),
  email: text.email('Introdu o adresă de e-mail validă.').or(z.literal('')).default(''),
}).passthrough().superRefine((data, context) => {
  if (data.clientType === 'PJ' && !data.cif) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['cif'], message: 'Completează CIF / CUI pentru persoana juridică.' })
  }
})

export function clientFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(error.issues.map(issue => [String(issue.path[0]), issue.message]))
}
