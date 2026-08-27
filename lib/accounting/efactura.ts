import { encrypt, decrypt } from "@/lib/crypto";
import { ready } from "@/lib/accounting/db";
import { getInvoiceFull, type Company, type Client, type Invoice, type InvoiceItem } from "@/lib/accounting/repo";

const AUTH_BASE = "https://logincert.anaf.ro/anaf-oauth2/v1";
const API_BASES = { test: "https://webserviceapl.anaf.ro/test/FCTEL/rest", production: "https://webserviceapl.anaf.ro/prod/FCTEL/rest" } as const;
export type AnafEnvironment = keyof typeof API_BASES;
export type EFacturaStatus = "DRAFT" | "UPLOADING" | "PROCESSING" | "VALIDATED" | "REJECTED" | "ERROR";

function config() {
  const environment: AnafEnvironment = process.env.ANAF_ENVIRONMENT === "production" ? "production" : "test";
  return { clientId: process.env.ANAF_CLIENT_ID || "", clientSecret: process.env.ANAF_CLIENT_SECRET || "", redirectUri: process.env.ANAF_REDIRECT_URI || "https://elmontz.vercel.app/api/accounting/efactura/callback", environment, apiBase: API_BASES[environment] };
}
export function getAnafPublicConfig() { const c = config(); return { configured: Boolean(c.clientId && c.clientSecret), environment: c.environment, redirectUri: c.redirectUri }; }
export function getAnafAuthorizeUrl(state: string) { const c = config(); if (!c.clientId) throw new Error("ANAF_CLIENT_ID nu este configurat."); const q = new URLSearchParams({ response_type: "code", client_id: c.clientId, redirect_uri: c.redirectUri, token_content_type: "jwt", state }); return `${AUTH_BASE}/authorize?${q}`; }

async function saveTokens(data: { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }) {
  const pool = await ready(); const expiresAt = new Date(Date.now() + Math.max(60, Number(data.expires_in || 3600)) * 1000);
  await pool.query(`INSERT INTO anaf_connections (id,"accessToken","refreshToken","expiresAt",scope) VALUES (1,$1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET "accessToken"=$1,"refreshToken"=$2,"expiresAt"=$3,scope=$4,"updatedAt"=now()`, [encrypt(data.access_token), data.refresh_token ? encrypt(data.refresh_token) : "", expiresAt, data.scope || ""]);
}
export async function exchangeAnafCode(code: string) { const c = config(); if (!c.clientId || !c.clientSecret) throw new Error("Acreditările OAuth ANAF nu sunt configurate."); const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: c.redirectUri, client_id: c.clientId, client_secret: c.clientSecret }); const response = await fetch(`${AUTH_BASE}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" }); const data = await response.json().catch(() => ({})); if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "ANAF nu a emis tokenul OAuth."); await saveTokens(data); }
async function refreshAccessToken(refreshToken: string) { const c = config(); const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: c.clientId, client_secret: c.clientSecret }); const response = await fetch(`${AUTH_BASE}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" }); const data = await response.json().catch(() => ({})); if (!response.ok || !data.access_token) throw new Error("Sesiunea ANAF a expirat. Reconectează certificatul în SPV."); await saveTokens({ ...data, refresh_token: data.refresh_token || refreshToken }); return data.access_token as string; }
export async function getAnafConnectionStatus() { const pool = await ready(); const { rows } = await pool.query(`SELECT "expiresAt","connectedAt","updatedAt",scope FROM anaf_connections WHERE id=1`); return { ...getAnafPublicConfig(), connected: Boolean(rows[0]), connection: rows[0] || null }; }
export async function disconnectAnaf() { await (await ready()).query(`DELETE FROM anaf_connections WHERE id=1`); }
async function accessToken() { const pool = await ready(); const { rows } = await pool.query(`SELECT * FROM anaf_connections WHERE id=1`); if (!rows[0]) throw new Error("Conectează mai întâi contul ANAF/SPV."); const token = decrypt(rows[0].accessToken); if (new Date(rows[0].expiresAt).getTime() > Date.now() + 60_000) return token; if (!rows[0].refreshToken) throw new Error("Sesiunea ANAF a expirat. Reconectează contul."); return refreshAccessToken(decrypt(rows[0].refreshToken)); }
async function anafFetch(path: string, init: RequestInit = {}) { const response = await fetch(`${config().apiBase}${path}`, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, ...(init.headers || {}) }, cache: "no-store" }); if (response.status === 401) throw new Error("Autorizarea ANAF a expirat. Reconectează SPV."); return response; }

function x(value: unknown) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }
function money(n: number) { return Number(n || 0).toFixed(2); }
function country(companyOrClient: { countryCode?: string }) { return companyOrClient.countryCode || "RO"; }
function vatId(cif: string, vatPayer: number) { const clean = cif.replace(/^RO/i, "").replace(/\s/g, ""); return vatPayer ? `RO${clean}` : clean; }
export function validateEFactura(full: { invoice: Invoice; items: InvoiceItem[]; client?: Client; company: Company }) { const errors: string[] = []; const { invoice, items, client, company } = full; if (!company.name) errors.push("Completează denumirea firmei emitente."); if (!company.cif) errors.push("Completează CIF-ul firmei emitente."); if (!company.address || !company.city || !company.county) errors.push("Completează adresa, localitatea și județul emitentului."); if (!client) errors.push("Clientul facturii nu există."); else { if (!client.name) errors.push("Completează denumirea clientului."); if (client.clientType === "PJ" && !client.cif) errors.push("Completează CIF-ul clientului."); if (!client.address || !client.city || !client.judet) errors.push("Completează adresa, localitatea și județul clientului."); } if (!invoice.series || !invoice.number) errors.push("Seria și numărul facturii sunt obligatorii."); if (!invoice.issueDate) errors.push("Data emiterii este obligatorie."); if (!items.length) errors.push("Factura trebuie să conțină cel puțin o poziție."); items.forEach((item, index) => { if (!item.description) errors.push(`Poziția ${index + 1}: denumire lipsă.`); if (!item.unitCode) errors.push(`Poziția ${index + 1}: cod unitate lipsă.`); if (!item.vatCategoryCode) errors.push(`Poziția ${index + 1}: categorie TVA lipsă.`); }); return errors; }
export function generateEFacturaXml({ invoice, items, client, company }: { invoice: Invoice; items: InvoiceItem[]; client: Client; company: Company }) { const errors = validateEFactura({ invoice, items, client, company }); if (errors.length) throw new Error(errors.join("\n")); const currency = invoice.currency || "RON"; const taxGroups = new Map<string,{rate:number,category:string,taxable:number,tax:number}>(); items.forEach(i => { const key=`${i.vatCategoryCode}|${i.vatRate}`; const g=taxGroups.get(key)||{rate:Number(i.vatRate),category:i.vatCategoryCode||"S",taxable:0,tax:0}; g.taxable+=Number(i.valoare); g.tax+=Number(i.vatValue); taxGroups.set(key,g); }); const taxSubtotals=[...taxGroups.values()].map(g=>`<cac:TaxSubtotal><cbc:TaxableAmount currencyID="${x(currency)}">${money(g.taxable)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${x(currency)}">${money(g.tax)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${x(g.category)}</cbc:ID><cbc:Percent>${money(g.rate)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`).join(""); const lines=items.map((i,index)=>`<cac:InvoiceLine><cbc:ID>${index+1}</cbc:ID><cbc:InvoicedQuantity unitCode="${x(i.unitCode||"H87")}">${i.qty}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${x(currency)}">${money(i.valoare)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${x(i.description)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${x(i.vatCategoryCode||"S")}</cbc:ID><cbc:Percent>${money(i.vatRate)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${x(currency)}">${money(i.unitPrice)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="${x(i.unitCode||"H87")}">1</cbc:BaseQuantity></cac:Price></cac:InvoiceLine>`).join(""); return `<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID><cbc:ID>${x(invoice.series)}-${invoice.number}</cbc:ID><cbc:IssueDate>${x(invoice.issueDate)}</cbc:IssueDate>${invoice.dueDate?`<cbc:DueDate>${x(invoice.dueDate)}</cbc:DueDate>`:""}<cbc:InvoiceTypeCode>${x(invoice.invoiceTypeCode||"380")}</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>${x(currency)}</cbc:DocumentCurrencyCode><cbc:TaxPointDate>${x(invoice.taxPointDate||invoice.issueDate)}</cbc:TaxPointDate><cac:AccountingSupplierParty><cac:Party><cac:PostalAddress><cbc:StreetName>${x(company.address)}</cbc:StreetName><cbc:CityName>${x(company.city)}</cbc:CityName><cbc:PostalZone>${x(company.postalCode)}</cbc:PostalZone><cbc:CountrySubentity>${x(company.county)}</cbc:CountrySubentity><cac:Country><cbc:IdentificationCode>${x(country(company))}</cbc:IdentificationCode></cac:Country></cac:PostalAddress><cac:PartyTaxScheme><cbc:CompanyID>${x(vatId(company.cif,company.vatPayer))}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${x(company.name)}</cbc:RegistrationName><cbc:CompanyID>${x(company.cif)}</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cac:Party><cac:PostalAddress><cbc:StreetName>${x(client.address)}</cbc:StreetName><cbc:CityName>${x(client.city)}</cbc:CityName><cbc:PostalZone>${x(client.postalCode)}</cbc:PostalZone><cbc:CountrySubentity>${x(client.judet)}</cbc:CountrySubentity><cac:Country><cbc:IdentificationCode>${x(country(client))}</cbc:IdentificationCode></cac:Country></cac:PostalAddress><cac:PartyTaxScheme><cbc:CompanyID>${x(vatId(client.clientType==="PF"?client.cnp:client.cif,client.vatPayer))}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${x(client.name)}</cbc:RegistrationName><cbc:CompanyID>${x(client.clientType==="PF"?client.cnp:client.cif)}</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty><cac:PaymentMeans><cbc:PaymentMeansCode>${x(invoice.paymentMeansCode||"30")}</cbc:PaymentMeansCode>${company.iban?`<cac:PayeeFinancialAccount><cbc:ID>${x(company.iban)}</cbc:ID></cac:PayeeFinancialAccount>`:""}</cac:PaymentMeans><cac:TaxTotal><cbc:TaxAmount currencyID="${x(currency)}">${money(invoice.vatTotal)}</cbc:TaxAmount>${taxSubtotals}</cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${x(currency)}">${money(invoice.subtotal)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${x(currency)}">${money(invoice.subtotal)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${x(currency)}">${money(invoice.total)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${x(currency)}">${money(invoice.total)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</Invoice>`; }
function parseId(text: string, names: string[]) { for (const name of names) { const json = new RegExp(`"${name}"\\s*:\\s*"?([^",}]+)`,"i").exec(text)?.[1]; if (json) return json.trim(); const xml = new RegExp(`<${name}[^>]*>([^<]+)`,"i").exec(text)?.[1]; if (xml) return xml.trim(); } return ""; }
export async function submitEFactura(invoiceId: number, xml: string, cif: string) {
  const pool = await ready();
  const connection = await pool.connect();
  let submissionId = 0;
  try {
    await connection.query("BEGIN");
    await connection.query(`SELECT pg_advisory_xact_lock($1,$2)`, [73001, invoiceId]);
    const latest = (await connection.query(
      `SELECT id,"uploadId",status FROM efactura_submissions WHERE "invoiceId"=$1 ORDER BY id DESC LIMIT 1`,
      [invoiceId]
    )).rows[0];
    if (latest && ["UPLOADING", "PROCESSING", "VALIDATED"].includes(String(latest.status))) {
      await connection.query("COMMIT");
      return { submissionId: Number(latest.id), uploadId: String(latest.uploadId || ""), status: String(latest.status), duplicatePrevented: true };
    }
    const { rows } = await connection.query(
      `INSERT INTO efactura_submissions ("invoiceId",status,"xmlSnapshot") VALUES ($1,'UPLOADING',$2) RETURNING id`,
      [invoiceId, xml]
    );
    submissionId = Number(rows[0].id);
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }

  try {
    const response = await anafFetch(`/upload?standard=UBL&cif=${encodeURIComponent(cif.replace(/^RO/i,""))}`, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: xml,
    });
    const responseText = await response.text();
    const uploadId = parseId(responseText, ["index_incarcare", "id_incarcare", "uploadId"]);
    if (!response.ok || !uploadId) throw new Error(responseText.slice(0, 500) || "ANAF nu a returnat identificatorul încărcării.");
    await pool.query(
      `UPDATE efactura_submissions SET "uploadId"=$1,status='PROCESSING',message=$2,"submittedAt"=now() WHERE id=$3`,
      [uploadId, responseText.slice(0, 1000), submissionId]
    );
    return { submissionId, uploadId, status: "PROCESSING" as EFacturaStatus, duplicatePrevented: false };
  } catch (error) {
    await pool.query(`UPDATE efactura_submissions SET status='ERROR',message=$1,"checkedAt"=now() WHERE id=$2`, [error instanceof Error ? error.message : String(error), submissionId]);
    throw error;
  }
}

export async function sendInvoiceToAnaf(invoiceId: number) {
  const full = await getInvoiceFull(invoiceId);
  if (!full?.client) throw new Error("Factura nu există sau clientul nu este disponibil.");
  const xml = generateEFacturaXml({ ...full, client: full.client });
  if (!full.company.cif) throw new Error("CIF emitent lipsă.");
  return submitEFactura(invoiceId, xml, full.company.cif);
}
export async function checkSubmission(id: number) { const pool=await ready(); const { rows }=await pool.query(`SELECT * FROM efactura_submissions WHERE id=$1`,[id]); const item=rows[0]; if(!item?.uploadId) throw new Error("Transmiterea nu are ID ANAF."); const response=await anafFetch(`/stareMesaj?id_incarcare=${encodeURIComponent(item.uploadId)}`); const text=await response.text(); const lower=text.toLowerCase(); const status: EFacturaStatus=lower.includes("nok")||lower.includes("eroare")?"REJECTED":lower.includes("ok")?"VALIDATED":"PROCESSING"; const downloadId=parseId(text,["id_descarcare","downloadId"]); await pool.query(`UPDATE efactura_submissions SET status=$1,message=$2,"downloadId"=$3,"checkedAt"=now() WHERE id=$4`,[status,text.slice(0,2000),downloadId,id]); return {status,message:text,downloadId}; }
export async function latestSubmission(invoiceId: number) { const { rows }=await (await ready()).query(`SELECT id,"uploadId",status,message,"downloadId","submittedAt","checkedAt" FROM efactura_submissions WHERE "invoiceId"=$1 ORDER BY id DESC LIMIT 1`,[invoiceId]); return rows[0]||null; }
export async function processAutomaticEFactura(limit = 20) {
  const pool = await ready();
  const publicConfig = getAnafPublicConfig();
  const connected = Number((await pool.query(`SELECT COUNT(*) AS count FROM anaf_connections WHERE id=1`)).rows[0].count) > 0;
  if (!publicConfig.configured || !connected) {
    return { skipped: true, reason: "Conexiunea ANAF/SPV nu este configurată.", checked: 0, sent: 0, failed: 0 };
  }

  let checked = 0;
  let sent = 0;
  let failed = 0;
  await pool.query(`UPDATE efactura_submissions SET status='ERROR', message='Trimiterea a rămas blocată și va fi reîncercată automat.', "checkedAt"=now() WHERE status='UPLOADING' AND "createdAt" < now() - interval '1 hour'`);
  const processing = await pool.query(
    `SELECT id FROM efactura_submissions WHERE status='PROCESSING' ORDER BY COALESCE("submittedAt","createdAt") ASC LIMIT $1`,
    [Math.max(1, Math.min(limit, 50))]
  );
  for (const row of processing.rows) {
    try { await checkSubmission(Number(row.id)); checked += 1; } catch { failed += 1; }
  }

  const candidates = await pool.query(
    `SELECT i.id FROM invoices i
     LEFT JOIN LATERAL (
       SELECT status,"createdAt" FROM efactura_submissions WHERE "invoiceId"=i.id ORDER BY id DESC LIMIT 1
     ) ef ON true
     WHERE i."autoEfactura"=1
       AND ((i."invoiceType"='STANDARD' AND i.status IN ('issued','partial','paid')) OR (i."invoiceType"='STORNO' AND i.status='storno'))
       AND (ef.status IS NULL OR (ef.status='ERROR' AND ef."createdAt" < now() - interval '6 hours'))
     ORDER BY i."issueDate" ASC, i.id ASC LIMIT $1`,
    [Math.max(1, Math.min(limit, 50))]
  );
  for (const row of candidates.rows) {
    try { await sendInvoiceToAnaf(Number(row.id)); sent += 1; } catch { failed += 1; }
  }
  return { skipped: false, checked, sent, failed };
}
export async function syncAnafMessages(cif: string, days=60) { const pool=await ready(); let count=0; for(const [filter,direction] of [["P","RECEIVED"],["T","SENT"]] as const){ const response=await anafFetch(`/listaMesajeFactura?zile=${days}&cif=${encodeURIComponent(cif.replace(/^RO/i,""))}&filtru=${filter}`); const text=await response.text(); const messages=[...text.matchAll(/<mesaj\b([^>]*)\/?>(?:<\/mesaj>)?/gi)]; for(const match of messages){ const attrs=Object.fromEntries([...match[1].matchAll(/([\w_]+)="([^"]*)"/g)].map(x=>[x[1],x[2]])); const messageId=attrs.id||attrs.id_solicitare||attrs.id_descarcare; if(!messageId) continue; await pool.query(`INSERT INTO efactura_messages ("messageId",direction,cif,details,"documentDate","downloadId") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("messageId") DO UPDATE SET details=$4,"downloadId"=$6`,[messageId,direction,attrs.cif||"",attrs.detalii||attrs.tip||"",attrs.data_creare||"",attrs.id_descarcare||messageId]); count++; } } return count; }
export async function listAnafMessages() { const { rows }=await (await ready()).query(`SELECT * FROM efactura_messages ORDER BY "createdAt" DESC LIMIT 500`); return rows; }
export async function downloadAnafMessage(downloadId: string) { const response=await anafFetch(`/descarcare?id=${encodeURIComponent(downloadId)}`); if(!response.ok) throw new Error(await response.text()); return { buffer:Buffer.from(await response.arrayBuffer()), contentType:response.headers.get("content-type")||"application/zip" }; }
