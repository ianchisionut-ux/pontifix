import { encrypt, decrypt } from "@/lib/crypto";
import { ready } from "@/lib/accounting/db";
import {
  getInvoiceFull,
  type Company,
  type Client,
  type Invoice,
  type InvoiceItem,
} from "@/lib/accounting/repo";

const AUTH_BASE = "https://logincert.anaf.ro/anaf-oauth2/v1";
// ANAF exposes two transports: webserviceapl.anaf.ro requires a client certificate
// on every request, while api.anaf.ro accepts the OAuth bearer token used here.
const API_BASES = {
  test: "https://api.anaf.ro/test/FCTEL/rest",
  production: "https://api.anaf.ro/prod/FCTEL/rest",
} as const;
export type AnafEnvironment = keyof typeof API_BASES;
export type EFacturaStatus =
  "DRAFT" | "UPLOADING" | "PROCESSING" | "VALIDATED" | "REJECTED" | "ERROR";

function config() {
  const environment: AnafEnvironment =
    process.env.ANAF_ENVIRONMENT === "production" ? "production" : "test";
  return {
    clientId: process.env.ANAF_CLIENT_ID || "",
    clientSecret: process.env.ANAF_CLIENT_SECRET || "",
    redirectUri:
      process.env.ANAF_REDIRECT_URI ||
      "https://elmontz.vercel.app/api/accounting/efactura/callback",
    environment,
    apiBase: API_BASES[environment],
  };
}
export function getAnafPublicConfig() {
  const c = config();
  return {
    configured: Boolean(c.clientId && c.clientSecret),
    environment: c.environment,
    redirectUri: c.redirectUri,
  };
}
export function getAnafAuthorizeUrl(state: string) {
  const c = config();
  if (!c.clientId) throw new Error("ANAF_CLIENT_ID nu este configurat.");
  const q = new URLSearchParams({
    response_type: "code",
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    token_content_type: "jwt",
    state,
  });
  return `${AUTH_BASE}/authorize?${q}`;
}

async function saveTokens(data: {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}) {
  const pool = await ready();
  const environment = config().environment;
  const expiresAt = new Date(
    Date.now() + Math.max(60, Number(data.expires_in || 3600)) * 1000,
  );
  await pool.query(
    `INSERT INTO anaf_connections (id,"accessToken","refreshToken","expiresAt",scope,environment) VALUES (1,$1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET "accessToken"=$1,"refreshToken"=$2,"expiresAt"=$3,scope=$4,environment=$5,"updatedAt"=now()`,
    [
      encrypt(data.access_token),
      data.refresh_token ? encrypt(data.refresh_token) : "",
      expiresAt,
      data.scope || "",
      environment,
    ],
  );
}
async function requestAnafToken(body: URLSearchParams) {
  const c = config();
  if (!c.clientId || !c.clientSecret)
    throw new Error("Acreditările OAuth ANAF nu sunt configurate.");
  body.set("token_content_type", "jwt");
  const credentials = Buffer.from(
    `${c.clientId}:${c.clientSecret}`,
    "utf8",
  ).toString("base64");
  return fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
}
export async function exchangeAnafCode(code: string) {
  const c = config();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: c.redirectUri,
  });
  const response = await requestAnafToken(body);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token)
    throw new Error(
      data.error_description || data.error || "ANAF nu a emis tokenul OAuth.",
    );
  await saveTokens(data);
}
async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await requestAnafToken(body);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token)
    throw new Error(
      data.error_description ||
        data.error ||
        "Sesiunea ANAF a expirat. Reconectează certificatul în SPV.",
    );
  await saveTokens({
    ...data,
    refresh_token: data.refresh_token || refreshToken,
  });
  return data.access_token as string;
}
export async function getAnafConnectionStatus() {
  const pool = await ready();
  const environment = config().environment;
  const automationId = environment === "production" ? 2 : 1;
  const [connectionResult, automationResult] = await Promise.all([
    pool.query(
      `SELECT "expiresAt","connectedAt","updatedAt",scope,environment FROM anaf_connections WHERE id=1 AND environment=$1`,
      [environment],
    ),
    pool.query(
      `SELECT status,checked,sent,failed,message,"lastRunAt","lastSuccessAt" FROM efactura_automation_state WHERE id=$1`,
      [automationId],
    ),
  ]);
  return {
    ...getAnafPublicConfig(),
    connected: Boolean(connectionResult.rows[0]),
    connection: connectionResult.rows[0] || null,
    automation: automationResult.rows[0] || null,
  };
}
export async function disconnectAnaf() {
  await (await ready()).query(`DELETE FROM anaf_connections WHERE id=1`);
}
async function accessToken() {
  const pool = await ready();
  const environment = config().environment;
  const { rows } = await pool.query(
    `SELECT * FROM anaf_connections WHERE id=1 AND environment=$1`,
    [environment],
  );
  if (!rows[0]) throw new Error("Conectează mai întâi contul ANAF/SPV.");
  const token = decrypt(rows[0].accessToken);
  if (new Date(rows[0].expiresAt).getTime() > Date.now() + 60_000) return token;
  if (!rows[0].refreshToken)
    throw new Error("Sesiunea ANAF a expirat. Reconectează contul.");
  return refreshAccessToken(decrypt(rows[0].refreshToken));
}
async function anafFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${config().apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: init.signal || AbortSignal.timeout(25_000),
  });
  if (response.status === 401)
    throw new Error("Autorizarea ANAF a expirat. Reconectează SPV.");
  return response;
}

function x(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function money(n: number) {
  return Number(n || 0).toFixed(2);
}
function price(n: number) {
  return Number(n || 0).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
function country(companyOrClient: { countryCode?: string }) {
  return String(companyOrClient.countryCode || "RO").trim().toUpperCase();
}
function cleanFiscalId(value: string) {
  return String(value || "").replace(/^RO/i, "").replace(/\s/g, "");
}
const ROMANIA_COUNTIES: Record<string, string> = {
  alba: "AB", arad: "AR", arges: "AG", bacau: "BC", bihor: "BH",
  "bistrita-nasaud": "BN", bistrita: "BN", botosani: "BT", brasov: "BV",
  braila: "BR", bucuresti: "B", buzau: "BZ", "caras-severin": "CS",
  calarasi: "CL", cluj: "CJ", constanta: "CT", covasna: "CV",
  dambovita: "DB", dolj: "DJ", galati: "GL", giurgiu: "GR", gorj: "GJ",
  harghita: "HR", hunedoara: "HD", ialomita: "IL", iasi: "IS", ilfov: "IF",
  maramures: "MM", mehedinti: "MH", mures: "MS", neamt: "NT", olt: "OT",
  prahova: "PH", "satu-mare": "SM", salaj: "SJ", sibiu: "SB", suceava: "SV",
  teleorman: "TR", timis: "TM", tulcea: "TL", vaslui: "VS", valcea: "VL", vrancea: "VN",
};
function plain(value: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function subdivision(value: string, countryCode: string) {
  const raw = String(value || "").trim();
  if (countryCode !== "RO") return raw;
  const withoutPrefix = raw.toUpperCase().replace(/^RO-/, "");
  if (/^(AB|AR|AG|BC|BH|BN|BT|BV|BR|B|BZ|CS|CL|CJ|CT|CV|DB|DJ|GL|GR|GJ|HR|HD|IL|IS|IF|MM|MH|MS|NT|OT|PH|SM|SJ|SB|SV|TR|TM|TL|VS|VL|VN)$/.test(withoutPrefix))
    return `RO-${withoutPrefix}`;
  const key = plain(raw).replace(/\s+/g, "-");
  return ROMANIA_COUNTIES[key] ? `RO-${ROMANIA_COUNTIES[key]}` : raw;
}
function xmlCity(value: string, subdivisionCode: string) {
  const raw = String(value || "").trim();
  if (subdivisionCode !== "RO-B") return raw;
  const sector = /^sector\s*([1-6])$/i.exec(raw)?.[1];
  return sector ? `SECTOR${sector}` : raw;
}
function optionalElement(name: string, value: unknown) {
  return String(value || "").trim() ? `<cbc:${name}>${x(value)}</cbc:${name}>` : "";
}
export function validateEFactura(full: {
  invoice: Invoice;
  items: InvoiceItem[];
  client?: Client;
  company: Company;
  originalInvoice?: Invoice;
}) {
  const errors: string[] = [];
  const { invoice, items, client, company } = full;
  if (!company.name) errors.push("Completează denumirea firmei emitente.");
  if (!company.cif) errors.push("Completează CIF-ul firmei emitente.");
  if (!company.address || !company.city || !company.county)
    errors.push("Completează adresa, localitatea și județul emitentului.");
  const companySubdivision = subdivision(company.county, country(company));
  if (country(company) === "RO" && !/^RO-(AB|AR|AG|BC|BH|BN|BT|BV|BR|B|BZ|CS|CL|CJ|CT|CV|DB|DJ|GL|GR|GJ|HR|HD|IL|IS|IF|MM|MH|MS|NT|OT|PH|SM|SJ|SB|SV|TR|TM|TL|VS|VL|VN)$/.test(companySubdivision))
    errors.push("Județul emitentului nu poate fi transformat într-un cod ISO valid (ex.: Sălaj / SJ).");
  if (companySubdivision === "RO-B" && !/^SECTOR[1-6]$/.test(xmlCity(company.city, companySubdivision)))
    errors.push("Pentru București, localitatea emitentului trebuie să fie Sector 1–6.");
  if (!client) errors.push("Clientul facturii nu există.");
  else {
    if (!client.name) errors.push("Completează denumirea clientului.");
    if (client.clientType === "PJ" && !client.cif)
      errors.push("Completează CIF-ul clientului.");
    if (!client.address || !client.city || !client.judet)
      errors.push("Completează adresa, localitatea și județul clientului.");
    const clientSubdivision = subdivision(client.judet, country(client));
    if (country(client) === "RO" && !/^RO-(AB|AR|AG|BC|BH|BN|BT|BV|BR|B|BZ|CS|CL|CJ|CT|CV|DB|DJ|GL|GR|GJ|HR|HD|IL|IS|IF|MM|MH|MS|NT|OT|PH|SM|SJ|SB|SV|TR|TM|TL|VS|VL|VN)$/.test(clientSubdivision))
      errors.push("Județul clientului nu poate fi transformat într-un cod ISO valid.");
    if (clientSubdivision === "RO-B" && !/^SECTOR[1-6]$/.test(xmlCity(client.city, clientSubdivision)))
      errors.push("Pentru un client din București, localitatea trebuie să fie Sector 1–6.");
  }
  if (!invoice.series || !invoice.number)
    errors.push("Seria și numărul facturii sunt obligatorii.");
  if (!invoice.issueDate) errors.push("Data emiterii este obligatorie.");
  const credit = invoice.invoiceType === "STORNO" || invoice.invoiceTypeCode === "381";
  const prepaid = credit ? 0 : Number(invoice.paidAmount || 0);
  if (!Number.isFinite(prepaid) || prepaid < 0 || prepaid > Math.abs(Number(invoice.total))) errors.push("Suma achitată este invalidă.");
  if (Math.abs(Number(invoice.total)) - prepaid > 0.005 && !(credit ? false : invoice.dueDate) && !invoice.paymentTerms?.trim()) errors.push("[BR-CO-25] Completează scadența sau termenii de plată pentru soldul pozitiv.");
  if (items.some(i => i.vatCategoryCode === 'O') && items.some(i => i.vatCategoryCode !== 'O')) errors.push("Categoria O nu poate fi combinată cu alte categorii TVA.");
  if ((invoice.invoiceType === "STORNO" || invoice.invoiceTypeCode === "381") && !full.originalInvoice)
    errors.push("Factura storno nu are referința completă către factura inițială.");
  if (!items.length)
    errors.push("Factura trebuie să conțină cel puțin o poziție.");
  items.forEach((item, index) => {
    if (!item.description) errors.push(`Poziția ${index + 1}: denumire lipsă.`);
    if (!item.unitCode) errors.push(`Poziția ${index + 1}: cod unitate lipsă.`);
    if (!item.vatCategoryCode)
      errors.push(`Poziția ${index + 1}: categorie TVA lipsă.`);
    if (!Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0)
      errors.push(`Poziția ${index + 1}: cantitatea trebuie să fie pozitivă.`);
    if (!Number.isFinite(Number(item.unitPrice)))
      errors.push(`Poziția ${index + 1}: preț invalid.`);
    if (!Number.isFinite(Number(item.vatRate)) || Number(item.vatRate) < 0)
      errors.push(`Poziția ${index + 1}: cotă TVA invalidă.`);
    if (["E", "AE", "K", "G", "O"].includes(String(item.vatCategoryCode || "")) && !String(item.taxExemptionReasonCode || item.taxExemptionReason || "").trim())
      errors.push(`Poziția ${index + 1}: motivul sau codul scutirii de TVA este obligatoriu.`);
    if (!company.vatPayer && (Number(item.vatRate) !== 0 || item.vatCategoryCode !== "O"))
      errors.push(`Poziția ${index + 1}: firma este setată neplătitoare de TVA; folosește cota 0%, categoria O și motivul legal.`);
  });
  return errors;
}
export function generateEFacturaXml({
  invoice,
  items,
  client,
  company,
  originalInvoice,
}: {
  invoice: Invoice;
  items: InvoiceItem[];
  client: Client;
  company: Company;
  originalInvoice?: Invoice;
}) {
  const errors = validateEFactura({ invoice, items, client, company, originalInvoice });
  if (errors.length) throw new Error(errors.join("\n"));
  const currency = invoice.currency || "RON";
  const outsideVat = items.some(i => i.vatCategoryCode === 'O');
  const isCreditNote = invoice.invoiceType === "STORNO" || invoice.invoiceTypeCode === "381";
  const taxGroups = new Map<
    string,
    { rate: number; category: string; taxable: number; tax: number; reasonCode: string; reason: string }
  >();
  items.forEach((item) => {
    const reasonCode = String(item.taxExemptionReasonCode || "").trim();
    const reason = String(item.taxExemptionReason || "").trim();
    const key = `${item.vatCategoryCode}|${item.vatRate}|${reasonCode}|${reason}`;
    const group = taxGroups.get(key) || {
      rate: Number(item.vatRate),
      category: item.vatCategoryCode || "S",
      taxable: 0,
      tax: 0,
      reasonCode,
      reason,
    };
    group.taxable += Math.abs(Number(item.valoare));
    group.tax += Math.abs(Number(item.vatValue));
    taxGroups.set(key, group);
  });
  const taxSubtotals = [...taxGroups.values()].map((group) =>
    `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="${x(currency)}">${money(group.taxable)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${x(currency)}">${money(group.tax)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${x(group.category)}</cbc:ID>${group.category === "O" ? "" : `<cbc:Percent>${money(group.rate)}</cbc:Percent>`}${optionalElement("TaxExemptionReasonCode", group.reasonCode)}${optionalElement("TaxExemptionReason", group.reason)}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`,
  ).join("");
  const lines = items.map((item, index) => {
    const category = item.vatCategoryCode || "S";
    const unitCode = item.unitCode || "H87";
    const quantity = Math.abs(Number(item.qty));
    const lineAmount = Math.abs(Number(item.valoare));
    const netUnitPrice = quantity ? lineAmount / quantity : 0;
    const lineName = isCreditNote ? "CreditNoteLine" : "InvoiceLine";
    const quantityName = isCreditNote ? "CreditedQuantity" : "InvoicedQuantity";
    return `<cac:${lineName}><cbc:ID>${index + 1}</cbc:ID><cbc:${quantityName} unitCode="${x(unitCode)}">${quantity}</cbc:${quantityName}><cbc:LineExtensionAmount currencyID="${x(currency)}">${money(lineAmount)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${x(item.description)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${x(category)}</cbc:ID>${category === "O" ? "" : `<cbc:Percent>${money(item.vatRate)}</cbc:Percent>`}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${x(currency)}">${price(netUnitPrice)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="${x(unitCode)}">1</cbc:BaseQuantity></cac:Price></cac:${lineName}>`;
  }).join("");
  const supplierCountry = country(company);
  const supplierSubdivision = subdivision(company.county, supplierCountry);
  const customerCountry = country(client);
  const customerSubdivision = subdivision(client.judet, customerCountry);
  const supplierFiscalId = cleanFiscalId(company.cif);
  const customerFiscalId = cleanFiscalId(client.clientType === "PF" ? client.cnp : client.cif);
  const supplierTax = `<cac:PartyTaxScheme><cbc:CompanyID>${x((company.vatPayer && !outsideVat) ? `RO${supplierFiscalId}` : supplierFiscalId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>${(company.vatPayer && !outsideVat) ? "VAT" : "FC"}</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`;
  const customerTax = client.vatPayer && !outsideVat
    ? `<cac:PartyTaxScheme><cbc:CompanyID>${x(`RO${customerFiscalId}`)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`
    : "";
  const supplierContact = company.phone || company.email
    ? `<cac:Contact>${optionalElement("Telephone", company.phone)}${optionalElement("ElectronicMail", company.email)}</cac:Contact>`
    : "";
  const customerContact = client.phone || client.email
    ? `<cac:Contact>${optionalElement("Telephone", client.phone)}${optionalElement("ElectronicMail", client.email)}</cac:Contact>`
    : "";
  const supplierParty = `<cac:AccountingSupplierParty><cac:Party><cac:PostalAddress><cbc:StreetName>${x(company.address)}</cbc:StreetName><cbc:CityName>${x(xmlCity(company.city, supplierSubdivision))}</cbc:CityName>${optionalElement("PostalZone", company.postalCode)}<cbc:CountrySubentity>${x(supplierSubdivision)}</cbc:CountrySubentity><cac:Country><cbc:IdentificationCode>${x(supplierCountry)}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>${supplierTax}<cac:PartyLegalEntity><cbc:RegistrationName>${x(company.name)}</cbc:RegistrationName><cbc:CompanyID>${x(supplierFiscalId)}</cbc:CompanyID></cac:PartyLegalEntity>${supplierContact}</cac:Party></cac:AccountingSupplierParty>`;
  const customerLegalId = customerFiscalId ? `<cbc:CompanyID>${x(customerFiscalId)}</cbc:CompanyID>` : "";
  const customerParty = `<cac:AccountingCustomerParty><cac:Party><cac:PostalAddress><cbc:StreetName>${x(client.address)}</cbc:StreetName><cbc:CityName>${x(xmlCity(client.city, customerSubdivision))}</cbc:CityName>${optionalElement("PostalZone", client.postalCode)}<cbc:CountrySubentity>${x(customerSubdivision)}</cbc:CountrySubentity><cac:Country><cbc:IdentificationCode>${x(customerCountry)}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>${customerTax}<cac:PartyLegalEntity><cbc:RegistrationName>${x(client.name)}</cbc:RegistrationName>${customerLegalId}</cac:PartyLegalEntity>${customerContact}</cac:Party></cac:AccountingCustomerParty>`;
  const typeElement = isCreditNote
    ? `<cbc:CreditNoteTypeCode>${x(invoice.invoiceTypeCode || "381")}</cbc:CreditNoteTypeCode>`
    : `<cbc:InvoiceTypeCode>${x(invoice.invoiceTypeCode || "380")}</cbc:InvoiceTypeCode>`;
  const billingReference = isCreditNote && originalInvoice
    ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${x(originalInvoice.series)}-${originalInvoice.number}</cbc:ID><cbc:IssueDate>${x(originalInvoice.issueDate)}</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>`
    : "";
  const paymentMeans = `<cac:PaymentMeans><cbc:PaymentMeansCode>${x(invoice.paymentMeansCode || "30")}</cbc:PaymentMeansCode>${company.iban ? `<cac:PayeeFinancialAccount><cbc:ID>${x(company.iban)}</cbc:ID></cac:PayeeFinancialAccount>` : ""}</cac:PaymentMeans>`;
  const root = isCreditNote ? "CreditNote" : "Invoice";
  const namespace = isCreditNote ? "CreditNote-2" : "Invoice-2";
  const subtotal = Math.abs(Number(invoice.subtotal));
  const vatTotal = Math.abs(Number(invoice.vatTotal));
  const total = Math.abs(Number(invoice.total));
  const prepaid = isCreditNote ? 0 : Number(invoice.paidAmount || 0);
  return `<?xml version="1.0" encoding="UTF-8"?><${root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${namespace}" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID><cbc:ID>${x(invoice.series)}-${invoice.number}</cbc:ID><cbc:IssueDate>${x(invoice.issueDate)}</cbc:IssueDate>${!isCreditNote && invoice.dueDate ? `<cbc:DueDate>${x(invoice.dueDate)}</cbc:DueDate>` : ""}${typeElement}${optionalElement("Note", invoice.notes)}<cbc:TaxPointDate>${x(invoice.taxPointDate || invoice.issueDate)}</cbc:TaxPointDate><cbc:DocumentCurrencyCode>${x(currency)}</cbc:DocumentCurrencyCode>${optionalElement("BuyerReference", invoice.buyerReference)}${billingReference}${supplierParty}${customerParty}${paymentMeans}${invoice.paymentTerms ? `<cac:PaymentTerms><cbc:Note>${x(invoice.paymentTerms)}</cbc:Note></cac:PaymentTerms>` : ""}<cac:TaxTotal><cbc:TaxAmount currencyID="${x(currency)}">${money(vatTotal)}</cbc:TaxAmount>${taxSubtotals}</cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${x(currency)}">${money(subtotal)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${x(currency)}">${money(subtotal)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${x(currency)}">${money(total)}</cbc:TaxInclusiveAmount>${prepaid > 0 ? `<cbc:PrepaidAmount currencyID="${x(currency)}">${money(prepaid)}</cbc:PrepaidAmount>` : ""}<cbc:PayableAmount currencyID="${x(currency)}">${money(total - prepaid)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</${root}>`;
}

function parseId(text: string, names: string[]) {
  for (const name of names) {
    const json = new RegExp(`"${name}"\\s*:\\s*"?([^",}]+)`, "i").exec(
      text,
    )?.[1];
    if (json) return json.trim();
    const attribute = new RegExp(
      `\\b${name}\\s*=\\s*["']([^"']+)["']`,
      "i",
    ).exec(text)?.[1];
    if (attribute) return attribute.trim();
    const xml = new RegExp(`<${name}[^>]*>([^<]+)`, "i").exec(text)?.[1];
    if (xml) return xml.trim();
  }
  return "";
}

class AnafSubmissionError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AnafSubmissionError";
  }
}

function isRetryableError(error: unknown) {
  if (error instanceof AnafSubmissionError) return error.retryable;
  if (error instanceof TypeError) return true; // fetch/network failure
  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))
    return true;
  return false;
}

async function recordPermanentInvoiceError(invoiceId: number, message: string) {
  const pool = await ready();
  const environment = config().environment;
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`SELECT pg_advisory_xact_lock($1,$2)`, [
      73001,
      invoiceId,
    ]);
    const latest = (
      await connection.query(
        `SELECT id,status,message FROM efactura_submissions WHERE "invoiceId"=$1 AND environment=$2 ORDER BY id DESC LIMIT 1`,
        [invoiceId, environment],
      )
    ).rows[0];
    if (latest && ['UPLOADING','PROCESSING','VALIDATED','UNCERTAIN'].includes(latest.status)) { await connection.query('COMMIT'); return; }
    if (!latest || latest.status !== "ERROR" || latest.message !== message) {
      const attempt = Number(
        (
          await connection.query(
            `SELECT COALESCE(MAX("attemptNumber"),0)+1 AS attempt FROM efactura_submissions WHERE "invoiceId"=$1 AND environment=$2`,
            [invoiceId, environment],
          )
        ).rows[0].attempt,
      );
      await connection.query(
        `INSERT INTO efactura_submissions ("invoiceId",status,message,"xmlSnapshot",retryable,"attemptNumber","checkedAt",environment)
         VALUES ($1,'ERROR',$2,'',0,$3,now(),$4)`,
        [invoiceId, message, attempt, environment],
      );
    }
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

export async function submitEFactura(
  invoiceId: number,
  xml: string,
  cif: string,
  approveEnvironment = false,
) {
  const pool = await ready();
  const environment = config().environment;
  const connection = await pool.connect();
  let submissionId = 0;
  let uploadAccessToken = '';
  try {
    await connection.query("BEGIN");
    await connection.query(`SELECT pg_advisory_xact_lock($1,$2)`, [
      73001,
      invoiceId,
    ]);
    const latest = (
      await connection.query(
        `SELECT id,"uploadId",status FROM efactura_submissions WHERE "invoiceId"=$1 AND environment=$2 ORDER BY id DESC LIMIT 1`,
        [invoiceId, environment],
      )
    ).rows[0];
    if (
      latest &&
      ["UPLOADING", "PROCESSING", "VALIDATED", "UNCERTAIN"].includes(String(latest.status))
    ) {
      await connection.query("COMMIT");
      return {
        submissionId: Number(latest.id),
        uploadId: String(latest.uploadId || ""),
        status: String(latest.status),
        duplicatePrevented: true,
      };
    }
    // Re-read under the same lock used by corrections, so a concurrent edit
    // cannot leave an outdated XML snapshot queued for transmission.
    const current = await getInvoiceFull(invoiceId);
    if (approveEnvironment) await connection.query(`UPDATE invoices SET "anafApprovedEnvironment"=$2 WHERE id=$1`, [invoiceId, environment]);
    const approval = (await connection.query(`SELECT "anafApprovedEnvironment" FROM invoices WHERE id=$1`, [invoiceId])).rows[0];
    if (approval?.anafApprovedEnvironment !== environment) throw new Error("Confirmă explicit trimiterea acestei facturi în mediul ANAF curent.");
    if (!current?.client || !['issued','partial','paid','storno'].includes(current.invoice.status)) throw new Error("Factura nu mai este eligibilă pentru transmitere.");
    xml = generateEFacturaXml({ ...current, client: current.client });
    cif = current.company.cif;
    // Authentication failures before upload are not ambiguous transmissions.
    uploadAccessToken = await accessToken();
    const attempt = Number(
      (
        await connection.query(
          `SELECT COALESCE(MAX("attemptNumber"),0)+1 AS attempt FROM efactura_submissions WHERE "invoiceId"=$1 AND environment=$2`,
          [invoiceId, environment],
        )
      ).rows[0].attempt,
    );
    const { rows } = await connection.query(
      `INSERT INTO efactura_submissions ("invoiceId",status,"xmlSnapshot",retryable,"attemptNumber",environment)
       VALUES ($1,'UPLOADING',$2,0,$3,$4) RETURNING id`,
      [invoiceId, xml, attempt, environment],
    );
    submissionId = Number(rows[0].id);
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }

  let definitiveFailure = false;
  try {
    const response = await fetch(
      `${config().apiBase}/upload?standard=UBL&cif=${encodeURIComponent(cif.replace(/^RO/i, ""))}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8", Authorization: `Bearer ${uploadAccessToken}` },
        signal: AbortSignal.timeout(25_000),
        body: xml,
      },
    );
    const responseText = await response.text();
    const uploadId = parseId(responseText, [
      "index_incarcare",
      "id_incarcare",
      "uploadId",
    ]);
    if (!response.ok) {
      definitiveFailure = response.status >= 400 && response.status < 500 && response.status !== 408;
      throw new AnafSubmissionError(
        responseText.slice(0, 500) ||
          `ANAF a răspuns cu HTTP ${response.status}.`,
        response.status === 429 || response.status >= 500,
      );
    }
    if (!uploadId)
      throw new AnafSubmissionError(
        responseText.slice(0, 500) ||
          "ANAF nu a returnat identificatorul încărcării.",
        true,
      );
    await pool.query(
      `UPDATE efactura_submissions SET "uploadId"=$1,status='PROCESSING',message=$2,"submittedAt"=now(),retryable=0 WHERE id=$3`,
      [uploadId, responseText.slice(0, 1000), submissionId],
    );
    return {
      submissionId,
      uploadId,
      status: "PROCESSING" as EFacturaStatus,
      duplicatePrevented: false,
    };
  } catch (error) {
    await pool.query(
      `UPDATE efactura_submissions SET status=$4,message=$1,retryable=$2,"checkedAt"=now() WHERE id=$3`,
      [
        error instanceof Error ? error.message : String(error),
        definitiveFailure && isRetryableError(error) ? 1 : 0,
        submissionId,
        definitiveFailure ? 'ERROR' : 'UNCERTAIN',
      ],
    );
    throw error;
  }
}

export async function sendInvoiceToAnaf(invoiceId: number, approveEnvironment = false) {
  const full = await getInvoiceFull(invoiceId);
  if (!full?.client)
    throw new Error("Factura nu există sau clientul nu este disponibil.");
  let xml: string;
  try {
    xml = generateEFacturaXml({ ...full, client: full.client });
    if (!full.company.cif) throw new Error("CIF emitent lipsă.");
  } catch (error) {
    await recordPermanentInvoiceError(
      invoiceId,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
  return submitEFactura(invoiceId, xml, full.company.cif, approveEnvironment);
}

export async function checkSubmission(id: number) {
  const pool = await ready();
  const environment = config().environment;
  const { rows } = await pool.query(
    `SELECT * FROM efactura_submissions WHERE id=$1 AND environment=$2`,
    [id, environment],
  );
  const item = rows[0];
  if (!item?.uploadId) throw new Error("Transmiterea nu are ID ANAF.");
  const response = await anafFetch(
    `/stareMesaj?id_incarcare=${encodeURIComponent(item.uploadId)}`,
  );
  const responseText = await response.text();
  if (!response.ok)
    throw new AnafSubmissionError(
      responseText.slice(0, 500) ||
        `ANAF a răspuns cu HTTP ${response.status}.`,
      response.status === 429 || response.status >= 500,
    );
  const lower = (/\bstare\s*=\s*["']([^"']+)["']/i.exec(responseText)?.[1] || "").toLowerCase();
  const status: EFacturaStatus =
    lower === "nok"
      ? "REJECTED"
      : lower === "ok"
        ? "VALIDATED"
        : "PROCESSING";
  const downloadId = parseId(responseText, ["id_descarcare", "downloadId"]);
  await pool.query(
    `UPDATE efactura_submissions SET status=$1,message=$2,"downloadId"=$3,"checkedAt"=now(),retryable=0 WHERE id=$4`,
    [status, responseText.slice(0, 2000), downloadId, id],
  );
  return { status, message: responseText, downloadId };
}

export async function latestSubmission(invoiceId: number) {
  const environment = config().environment;
  const { rows } = await (
    await ready()
  ).query(
    `SELECT id,"uploadId",status,message,"downloadId","submittedAt","checkedAt",retryable,"attemptNumber",environment
       FROM efactura_submissions WHERE "invoiceId"=$1 AND environment=$2 ORDER BY id DESC LIMIT 1`,
    [invoiceId, environment],
  );
  return rows[0] || null;
}

export async function invoiceDownloadXml(invoiceId: number) {
  const { rows } = await (await ready()).query(`SELECT "xmlSnapshot" FROM efactura_submissions WHERE "invoiceId"=$1 AND environment=$2 AND (COALESCE("uploadId",'')<>'' OR status IN ('UPLOADING','UNCERTAIN')) ORDER BY id DESC LIMIT 1`, [invoiceId, config().environment]);
  if (rows[0]) {
    if (!rows[0].xmlSnapshot) throw new Error('Copia XML transmisă lipsește. Descarcă răspunsul ANAF.');
    return String(rows[0].xmlSnapshot);
  }
  const full = await getInvoiceFull(invoiceId);
  if (!full?.client) throw new Error('Factura nu există.');
  return generateEFacturaXml({ ...full, client: full.client });
}

async function saveAutomationState(
  status: string,
  counts: { checked: number; sent: number; failed: number },
  message = "",
) {
  const pool = await ready();
  const stateId = config().environment === "production" ? 2 : 1;
  await pool.query(
    `INSERT INTO efactura_automation_state (id,status,checked,sent,failed,message,"lastRunAt","lastSuccessAt")
     VALUES ($6,$1,$2,$3,$4,$5,now(),CASE WHEN $1='SUCCESS' THEN now() ELSE NULL END)
     ON CONFLICT (id) DO UPDATE SET status=$1,checked=$2,sent=$3,failed=$4,message=$5,
       "lastRunAt"=now(),"lastSuccessAt"=CASE WHEN $1='SUCCESS' THEN now() ELSE efactura_automation_state."lastSuccessAt" END,
       "updatedAt"=now()`,
    [status, counts.checked, counts.sent, counts.failed, message, stateId],
  );
}

export async function recordAutomationFailure(error: unknown) {
  await saveAutomationState(
    "ERROR",
    { checked: 0, sent: 0, failed: 1 },
    error instanceof Error ? error.message : String(error),
  );
}

export async function processAutomaticEFactura(limit = 20) {
  const startedAt = Date.now();
  const pool = await ready();
  await saveAutomationState("RUNNING", { checked: 0, sent: 0, failed: 0 });
  const publicConfig = getAnafPublicConfig();
  const environment = publicConfig.environment;
  const connected =
    Number(
      (
        await pool.query(
          `SELECT COUNT(*) AS count FROM anaf_connections WHERE id=1 AND environment=$1`,
          [environment],
        )
      ).rows[0].count,
    ) > 0;
  if (!publicConfig.configured || !connected) {
    const result = {
      skipped: true,
      reason: "Conexiunea ANAF/SPV nu este configurată.",
      checked: 0,
      sent: 0,
      failed: 0,
    };
    await saveAutomationState("SKIPPED", result, result.reason);
    return result;
  }

  let checked = 0;
  let sent = 0;
  let failed = 0;
  await pool.query(
    `UPDATE efactura_submissions
        SET status='UNCERTAIN', retryable=0,
            message='Rezultat necunoscut. Verifică în SPV înainte de orice retrimitere; nu se reîncearcă automat.', "checkedAt"=now()
      WHERE status='UPLOADING' AND environment=$1 AND "createdAt" < now() - interval '1 hour'`,
    [environment],
  );

  const processing = await pool.query(
    `SELECT id FROM efactura_submissions WHERE status='PROCESSING' AND environment=$2
      ORDER BY COALESCE("submittedAt","createdAt") ASC LIMIT $1`,
    [Math.max(1, Math.min(limit, 50)), environment],
  );
  for (const row of processing.rows) {
    if (Date.now() - startedAt > 100_000) break;
    try {
      await checkSubmission(Number(row.id));
      checked += 1;
    } catch {
      failed += 1;
    }
  }

  const candidates = await pool.query(
    `SELECT i.id FROM invoices i
     LEFT JOIN LATERAL (
       SELECT status,retryable,"createdAt","checkedAt" FROM efactura_submissions
        WHERE "invoiceId"=i.id AND environment=$2 ORDER BY id DESC LIMIT 1
     ) ef ON true
     WHERE i."autoEfactura"=1
       AND i."anafApprovedEnvironment"=$2
       AND (i."anafSendAfter" IS NULL OR i."anafSendAfter" <= now())
       AND ((i."invoiceType"='STANDARD' AND i.status IN ('issued','partial','paid')) OR (i."invoiceType"='STORNO' AND i.status='storno'))
       AND (ef.status IS NULL OR (ef.status='ERROR' AND ef.retryable=1
            AND COALESCE(ef."checkedAt",ef."createdAt") < now() - interval '6 hours'))
     ORDER BY i."issueDate" ASC, i.id ASC LIMIT $1`,
    [Math.max(1, Math.min(limit, 50)), environment],
  );
  for (const row of candidates.rows) {
    if (Date.now() - startedAt > 240_000) break;
    try {
      await sendInvoiceToAnaf(Number(row.id));
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  const result = { skipped: false, checked, sent, failed };
  await saveAutomationState(
    failed > 0 ? "WARNING" : "SUCCESS",
    result,
    failed > 0 ? `${failed} operațiuni necesită reverificare.` : "",
  );
  return result;
}
export async function syncAnafMessages(cif: string, days = 60) {
  const pool = await ready();
  const environment = config().environment;
  let count = 0;
  const safeDays = Math.min(60, Math.max(1, days));
  for (const [filter, direction] of [
    ["P", "RECEIVED"],
    ["T", "SENT"],
  ] as const) {
    const response = await anafFetch(
      `/listaMesajeFactura?zile=${safeDays}&cif=${encodeURIComponent(cif.replace(/^RO/i, ""))}&filtru=${filter}`,
    );
    const text = await response.text();
    if (!response.ok)
      throw new Error(
        text.slice(0, 500) || `ANAF a răspuns cu HTTP ${response.status}.`,
      );
    const payload = JSON.parse(text) as {
      mesaje?: Array<Record<string, unknown>>;
      eroare?: string;
    };
    if (payload.eroare && !/nu exista mesaje/i.test(payload.eroare))
      throw new Error(payload.eroare);
    for (const item of payload.mesaje || []) {
      const messageId = String(item.id || item.id_solicitare || "");
      if (!messageId) continue;
      await pool.query(
        `INSERT INTO efactura_messages (environment,"messageId",direction,cif,details,"documentDate","downloadId") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (environment,"messageId") DO UPDATE SET details=EXCLUDED.details,"downloadId"=EXCLUDED."downloadId"`,
        [
          environment,
          messageId,
          direction,
          String(item.cif || ""),
          String(item.detalii || item.tip || ""),
          String(item.data_creare || ""),
          String(item.id || messageId),
        ],
      );
      count++;
    }
  }
  return count;
}
export async function listAnafMessages() {
  const environment = config().environment;
  const { rows } = await (
    await ready()
  ).query(
    `SELECT * FROM efactura_messages WHERE environment=$1 ORDER BY "createdAt" DESC LIMIT 500`,
    [environment],
  );
  return rows;
}
export async function downloadAnafMessage(downloadId: string) {
  const response = await anafFetch(
    `/descarcare?id=${encodeURIComponent(downloadId)}`,
  );
  if (!response.ok) throw new Error(await response.text());
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/zip",
  };
}
