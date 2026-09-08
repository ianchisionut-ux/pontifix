const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(path.join(process.cwd(), "lib/accounting/efactura.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
function mockRequire(id) {
  if (id.endsWith("/crypto")) return { encrypt: String, decrypt: String };
  if (id.endsWith("/db")) return { ready: async () => { throw new Error("DB access is not allowed in the XML self-test."); } };
  if (id.endsWith("/repo")) return { getInvoiceFull: async () => undefined };
  return require(id);
}
new Function("require", "module", "exports", "process", "Buffer", "AbortSignal", compiled)(
  mockRequire, loaded, loaded.exports, process, Buffer, AbortSignal,
);
const { generateEFacturaXml, validateEFactura } = loaded.exports;
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const company = {
  name: "NEXTLEVEL AUTOMATION SRL", cif: "55476878", address: "Str. Fundaturii 1A",
  city: "Mirsid", county: "Salaj", countryCode: "RO", postalCode: "", vatPayer: 0,
  iban: "RO49AAAA1B31007593840000", phone: "0700000000", email: "office@example.ro",
};
const client = {
  name: "CLIENT TEST SRL", clientType: "PJ", cif: "31321779", cnp: "",
  address: "Str. Test 1", city: "Zalau", judet: "Salaj", countryCode: "RO",
  postalCode: "", vatPayer: 0, phone: "", email: "",
};
const baseInvoice = {
  id: 1, series: "SJNXT", number: 1, issueDate: "2026-09-04", dueDate: "2026-09-19",
  invoiceType: "STANDARD", invoiceTypeCode: "380", currency: "RON", taxPointDate: "2026-09-04",
  paymentMeansCode: "30", paymentTerms: "15 zile", buyerReference: "CTR-1", notes: "Test",
  subtotal: 100, vatTotal: 0, total: 100,
};
const item = {
  description: "Servicii web", qty: 1, unitPrice: 100, valoare: 100, vatRate: 0,
  vatValue: 0, unitCode: "H87", vatCategoryCode: "O", taxExemptionReasonCode: "",
  taxExemptionReason: "Neînregistrat în scopuri de TVA conform art. 316 din Codul fiscal.",
};
const standard = generateEFacturaXml({ invoice: baseInvoice, items: [item], client, company });
assert(standard.startsWith('<?xml version="1.0" encoding="UTF-8"?><Invoice '), "Factura normală nu are rădăcina UBL Invoice.");
assert(standard.includes("<cbc:CountrySubentity>RO-SJ</cbc:CountrySubentity>"), "Județul Sălaj nu este normalizat la RO-SJ.");
assert(standard.indexOf("<cbc:TaxPointDate>") < standard.indexOf("<cbc:DocumentCurrencyCode>"), "Ordinea UBL TaxPointDate/DocumentCurrencyCode este greșită.");
assert(standard.includes("<cbc:BuyerReference>CTR-1</cbc:BuyerReference>"), "BuyerReference lipsește.");
assert(standard.includes("<cac:PaymentTerms><cbc:Note>15 zile</cbc:Note>"), "PaymentTerms lipsește.");
assert(standard.includes("<cbc:ID>FC</cbc:ID>"), "Identificarea fiscală a emitentului neplătitor TVA lipsește.");
assert(standard.includes("<cbc:TaxExemptionReason>"), "Motivul regimului TVA lipsește.");

const originalInvoice = { ...baseInvoice, id: 1 };
const creditInvoice = {
  ...baseInvoice, id: 2, series: "STO", number: 1, dueDate: "2026-09-04",
  invoiceType: "STORNO", invoiceTypeCode: "381", subtotal: -100, vatTotal: 0, total: -100,
};
const creditItem = { ...item, description: "STORNO - Servicii web", unitPrice: -100, valoare: -100 };
const credit = generateEFacturaXml({ invoice: creditInvoice, items: [creditItem], client, company, originalInvoice });
assert(credit.startsWith('<?xml version="1.0" encoding="UTF-8"?><CreditNote '), "Storno nu are rădăcina UBL CreditNote.");
assert(credit.includes("<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>"), "Codul 381 lipsește.");
assert(credit.includes("<cac:CreditNoteLine>"), "Linia CreditNote lipsește.");
assert(credit.includes("<cbc:CreditedQuantity"), "Cantitatea creditată lipsește.");
assert(credit.includes("<cac:BillingReference>"), "Referința la factura inițială lipsește.");
assert(!/>-\d/.test(credit), "CreditNote conține valori monetare negative.");
assert(validateEFactura({ invoice: baseInvoice, items: [{ ...item, vatRate: 21, vatCategoryCode: "S" }], client, company }).length > 0, "Regimul TVA incompatibil nu a fost respins.");

const paid = generateEFacturaXml({ invoice: { ...baseInvoice, dueDate: '', paymentTerms: '', paidAmount: 100 }, items: [item], client: { ...client, vatPayer: 1 }, company });
assert(paid.includes('<cbc:PrepaidAmount currencyID="RON">100.00</cbc:PrepaidAmount>'), 'Suma achitată lipsește.');
assert(paid.includes('<cbc:PayableAmount currencyID="RON">0.00</cbc:PayableAmount>'), 'Soldul achitat nu este zero.');
assert(!(paid.match(/<cac:PartyTaxScheme>[\s\S]*?<\/cac:PartyTaxScheme>/g) || []).some(p => p.includes('<cbc:ID>VAT</cbc:ID>')), 'Categoria O include un identificator TVA.');
assert(validateEFactura({ invoice: { ...baseInvoice, dueDate: '', paymentTerms: '' }, items: [item], client, company }).some(e => e.includes('BR-CO-25')), 'Lipsa scadenței nu este detectată.');
const partial = generateEFacturaXml({ invoice: { ...baseInvoice, paidAmount: 25 }, items: [item], client, company });
assert(partial.includes('<cbc:PayableAmount currencyID="RON">75.00</cbc:PayableAmount>'), 'Soldul parțial este greșit.');
console.log("Accounting XML self-test passed.");
