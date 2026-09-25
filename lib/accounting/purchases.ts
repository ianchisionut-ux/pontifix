import { ready } from "./db";
import { postPurchaseInvoiceToLedger, postSupplierPaymentToLedger } from "./ledger";
import { defaultVatRegimeReason, isVatRegimeCode, suggestVatRegime, vatRegimeNeedsReason, type VatRegimeCode } from "./vat-regime";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const text = (value: unknown) => String(value ?? "").trim();
const flag = (value: unknown) => value === true || value === 1 || value === "1" ? 1 : 0;
const validDate = (value:string) => {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
};

export type SupplierInput = {
  name?: string; cif?: string; regCom?: string; countryCode?: string; county?: string; city?: string;
  address?: string; postalCode?: string; bankAccount?: string; bank?: string; phone?: string; email?: string;
  vatPayer?: boolean | number; vatOnCollection?: boolean | number; inactive?: boolean | number;
  dueDays?: number; blocked?: boolean | number; warning?: boolean | number; affiliated?: boolean | number; notes?: string;
};

function supplierValues(input: SupplierInput) {
  const name = text(input.name);
  if (!name) throw new Error("Completează denumirea furnizorului.");
  return [name, text(input.cif).toUpperCase().replace(/^RO\s*/, ""), text(input.regCom), text(input.countryCode || "RO").toUpperCase(),
    text(input.county), text(input.city), text(input.address), text(input.postalCode), text(input.bankAccount).replace(/\s/g, "").toUpperCase(),
    text(input.bank), text(input.phone), text(input.email), flag(input.vatPayer), flag(input.vatOnCollection), flag(input.inactive),
    Math.max(0, Math.min(365, Number(input.dueDays ?? 30))), flag(input.blocked), flag(input.warning), flag(input.affiliated), text(input.notes)];
}

export async function listSuppliers(search = "") {
  const pool = await ready();
  const q = `%${text(search)}%`;
  return (await pool.query(
    `SELECT s.*,COALESCE(SUM(CASE WHEN p.status<>'CANCELED' THEN (p.total-p."paidAmount")*p."exchangeRate" ELSE 0 END),0) AS outstanding,
            COUNT(p.id)::int AS "invoiceCount"
       FROM suppliers s LEFT JOIN purchase_invoices p ON p."supplierId"=s.id
      WHERE ($1='%%' OR s.name ILIKE $1 OR s.cif ILIKE $1 OR s.code ILIKE $1)
      GROUP BY s.id ORDER BY s.name`, [q],
  )).rows;
}

export async function createSupplier(input: SupplierInput) {
  const connection = await (await ready()).connect();
  try {
    await connection.query("BEGIN");
    const values = supplierValues(input);
    const { rows } = await connection.query(
      `INSERT INTO suppliers
        (name,cif,"regCom","countryCode",county,city,address,"postalCode","bankAccount",bank,phone,email,"vatPayer","vatOnCollection",inactive,"dueDays",blocked,warning,affiliated,notes)
       VALUES (${values.map((_, index) => `$${index + 1}`).join(",")}) RETURNING id`, values,
    );
    const id = Number(rows[0].id);
    const code = String(id).padStart(5, "0");
    const analyticAccount = `401.${code}`;
    await connection.query(`UPDATE suppliers SET code=$2,"analyticAccount"=$3 WHERE id=$1`, [id, code, analyticAccount]);
    await connection.query(
      `INSERT INTO accounting_accounts (code,name,nature,"allowPosting",active,system)
       VALUES ($1,$2,'CREDIT',1,1,0) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,active=1,"updatedAt"=now()`,
      [analyticAccount, `Furnizor - ${values[0]}`],
    );
    await connection.query("COMMIT");
    return id;
  } catch (error) {
    await connection.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") throw new Error("Există deja un furnizor cu acest CUI.");
    throw error;
  } finally { connection.release(); }
}

export async function updateSupplier(id: number, input: SupplierInput) {
  const values = supplierValues(input);
  const connection = await (await ready()).connect();
  try {
    await connection.query("BEGIN");
    const result = await connection.query(
      `UPDATE suppliers SET name=$1,cif=$2,"regCom"=$3,"countryCode"=$4,county=$5,city=$6,address=$7,"postalCode"=$8,
       "bankAccount"=$9,bank=$10,phone=$11,email=$12,"vatPayer"=$13,"vatOnCollection"=$14,inactive=$15,"dueDays"=$16,
       blocked=$17,warning=$18,affiliated=$19,notes=$20,"updatedAt"=now() WHERE id=$21 RETURNING "analyticAccount"`, [...values, id],
    );
    if (!result.rowCount) throw new Error("Furnizorul nu există.");
    await connection.query(`UPDATE accounting_accounts SET name=$2,"updatedAt"=now() WHERE code=$1`, [result.rows[0].analyticAccount, `Furnizor - ${values[0]}`]);
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") throw new Error("Există deja un furnizor cu acest CUI.");
    throw error;
  } finally { connection.release(); }
}

type PurchaseItemInput = { description?: string; expenseAccount?: string; unit?: string; quantity?: number; unitPrice?: number; vatRate?: number; vatCategoryCode?: VatRegimeCode; taxExemptionReasonCode?: string; taxExemptionReason?: string; deductibilityPercent?: number };
type PurchaseInput = { supplierId?: number; documentType?: string; documentNumber?: string; issueDate?: string; dueDate?: string;
  currency?: string; exchangeRate?: number; reverseCharge?: boolean; vatOnCollection?: boolean; notes?: string; items?: PurchaseItemInput[] };

export async function listPurchases(from = "", to = "", supplierId = 0) {
  const pool = await ready();
  return (await pool.query(
    `SELECT p.*,s.name AS "supplierName",s.cif AS "supplierCif",s."analyticAccount"
       FROM purchase_invoices p JOIN suppliers s ON s.id=p."supplierId"
      WHERE ($1='' OR p."issueDate">=$1::date) AND ($2='' OR p."issueDate"<=$2::date) AND ($3=0 OR p."supplierId"=$3)
      ORDER BY p."issueDate" DESC,p.id DESC`, [from, to, supplierId],
  )).rows;
}

export async function createPurchase(input: PurchaseInput) {
  const supplierId = Number(input.supplierId || 0);
  const documentNumber = text(input.documentNumber);
  const issueDate = text(input.issueDate);
  const dueDate = text(input.dueDate || issueDate);
  const items = Array.isArray(input.items) ? input.items : [];
  if (!supplierId) throw new Error("Selectează furnizorul.");
  if (!documentNumber) throw new Error("Completează numărul documentului.");
  if (!validDate(issueDate) || !validDate(dueDate)) throw new Error("Data documentului sau scadența nu este validă.");
  if (!items.length) throw new Error("Adaugă cel puțin o poziție în factură.");
  const reverseCharge = flag(input.reverseCharge);
  const normalized = items.map((item, index) => {
    const quantity = Number(item.quantity || 0), unitPrice = Number(item.unitPrice || 0), enteredVatRate = Number(item.vatRate || 0);
    const deductibility = Math.max(0, Math.min(100, Number(item.deductibilityPercent ?? 100)));
    if (!text(item.description) || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !Number.isFinite(enteredVatRate) || !Number.isFinite(deductibility) || quantity <= 0 || unitPrice < 0 || enteredVatRate < 0 || enteredVatRate > 100) throw new Error(`Poziția ${index + 1} nu este completată corect.`);
    if (item.vatCategoryCode && !isVatRegimeCode(item.vatCategoryCode)) throw new Error(`Regimul TVA al poziției ${index + 1} nu este valid.`);
    const vatCategoryCode = item.vatCategoryCode || suggestVatRegime({ type: "EXPENSE", vatRate: enteredVatRate, reverseCharge: Boolean(reverseCharge) });
    const vatRate = vatCategoryCode === "S" ? enteredVatRate : 0;
    const taxExemptionReasonCode = text(item.taxExemptionReasonCode);
    const taxExemptionReason = text(item.taxExemptionReason) || defaultVatRegimeReason(vatCategoryCode);
    if (vatCategoryCode === "S" && vatRate <= 0) throw new Error(`Poziția ${index + 1}: regimul standard necesită o cotă TVA pozitivă.`);
    if (vatRegimeNeedsReason(vatCategoryCode) && !taxExemptionReason && !taxExemptionReasonCode) throw new Error(`Poziția ${index + 1}: completează motivul legal al regimului TVA.`);
    return { description: text(item.description), expenseAccount: text(item.expenseAccount || "628"), unit: text(item.unit || "buc"), quantity,
      unitPrice, vatRate, vatCategoryCode, taxExemptionReasonCode, taxExemptionReason, deductibility, net: round2(quantity * unitPrice), vat: round2(quantity * unitPrice * vatRate / 100) };
  });
  const exchangeRate = Number(input.exchangeRate || 1);
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error("Cursul valutar nu este valid.");
  const subtotal = round2(normalized.reduce((sum, item) => sum + item.net, 0));
  const vatTotal = round2(normalized.reduce((sum, item) => sum + item.vat, 0));
  const total = reverseCharge ? subtotal : round2(subtotal + vatTotal);
  const year = Number(issueDate.slice(0, 4));
  const connection = await (await ready()).connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`SELECT pg_advisory_xact_lock(73002,$1)`, [year]);
    const supplier = (await connection.query(`SELECT blocked FROM suppliers WHERE id=$1`, [supplierId])).rows[0];
    if (!supplier) throw new Error("Furnizorul selectat nu există.");
    if (supplier.blocked) throw new Error("Furnizorul este blocat. Deblochează-l înainte de operare.");
    const accountCodes = [...new Set(normalized.map((item) => item.expenseAccount))];
    const accounts = await connection.query(`SELECT code FROM accounting_accounts WHERE code=ANY($1::text[]) AND active=1 AND "allowPosting"=1`, [accountCodes]);
    if (accounts.rowCount !== accountCodes.length) throw new Error("Unul dintre conturile de cheltuială este inexistent, inactiv sau sintetic.");
    const internalNumber = Number((await connection.query(`SELECT COALESCE(MAX("internalNumber"),0)+1 AS next FROM purchase_invoices WHERE year=$1`, [year])).rows[0].next);
    const { rows } = await connection.query(
      `INSERT INTO purchase_invoices ("internalNumber",year,"supplierId","documentType","documentNumber","issueDate","dueDate",currency,"exchangeRate",subtotal,"vatTotal",total,"reverseCharge","vatOnCollection",notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [internalNumber, year, supplierId, text(input.documentType || "FACTURA"), documentNumber, issueDate, dueDate, text(input.currency || "RON").toUpperCase(), exchangeRate, subtotal, vatTotal, total, reverseCharge, flag(input.vatOnCollection), text(input.notes)],
    );
    const id = Number(rows[0].id);
    for (const item of normalized) await connection.query(
      `INSERT INTO purchase_invoice_items ("purchaseInvoiceId",description,"expenseAccount",unit,quantity,"unitPrice","vatRate","netAmount","vatAmount","deductibilityPercent","vatCategoryCode","taxExemptionReasonCode","taxExemptionReason")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [id,item.description,item.expenseAccount,item.unit,item.quantity,item.unitPrice,item.vatRate,item.net,item.vat,item.deductibility,item.vatCategoryCode,item.taxExemptionReasonCode,item.taxExemptionReason],
    );
    await postPurchaseInvoiceToLedger(id, connection);
    await connection.query("COMMIT");
    return id;
  } catch (error) {
    await connection.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") throw new Error("Documentul este deja înregistrat pentru acest furnizor.");
    throw error;
  } finally { connection.release(); }
}

export async function addSupplierPayment(purchaseInvoiceId: number, input: { date?: string; amount?: number; method?: string; reference?: string; notes?: string }) {
  const date = text(input.date), amount = round2(Number(input.amount || 0));
  if (!validDate(date) || !Number.isFinite(amount) || amount <= 0) throw new Error("Data sau suma plății nu este validă.");
  const method=text(input.method || "BANK").toUpperCase();
  if(!["BANK","CASH","CARD","NUMERAR","TRANSFER"].includes(method))throw new Error("Metoda de plată nu este validă.");
  const connection = await (await ready()).connect();
  try {
    await connection.query("BEGIN");
    const invoice = (await connection.query(`SELECT total,"paidAmount",status FROM purchase_invoices WHERE id=$1 FOR UPDATE`, [purchaseInvoiceId])).rows[0];
    if (!invoice || invoice.status === "CANCELED") throw new Error("Factura de furnizor nu poate fi plătită.");
    const outstanding = round2(Number(invoice.total) - Number(invoice.paidAmount));
    if (amount > outstanding + 0.009) throw new Error(`Suma depășește restul de plată (${outstanding.toFixed(2)}).`);
    const { rows } = await connection.query(
      `INSERT INTO supplier_payments ("purchaseInvoiceId",date,amount,method,reference,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [purchaseInvoiceId,date,amount,method,text(input.reference),text(input.notes)],
    );
    const newPaid = round2(Number(invoice.paidAmount) + amount);
    await connection.query(`UPDATE purchase_invoices SET "paidAmount"=$2,status=$3 WHERE id=$1`, [purchaseInvoiceId,newPaid,newPaid >= Number(invoice.total)-0.009 ? "PAID" : "PARTIAL"]);
    await postSupplierPaymentToLedger(Number(rows[0].id), connection);
    await connection.query("COMMIT");
    return Number(rows[0].id);
  } catch (error) { await connection.query("ROLLBACK"); throw error; } finally { connection.release(); }
}

export async function supplierSituation(asOf = "") {
  if(asOf&&!validDate(asOf))throw new Error("Data situației furnizorilor nu este validă.");
  const pool = await ready();
  return (await pool.query(
    `SELECT s.id,s.code,s.name,s.cif,s."analyticAccount",COUNT(p.id)::int AS documents,
            COALESCE(SUM(p.total*p."exchangeRate"),0) AS total,COALESCE(SUM(paid.amount*p."exchangeRate"),0) AS paid,
            COALESCE(SUM((p.total-paid.amount)*p."exchangeRate"),0) AS outstanding,
            COALESCE(SUM(CASE WHEN p."dueDate"<COALESCE(NULLIF($1,'')::date,CURRENT_DATE) THEN (p.total-paid.amount)*p."exchangeRate" ELSE 0 END),0) AS overdue
       FROM suppliers s LEFT JOIN purchase_invoices p ON p."supplierId"=s.id AND p.status<>'CANCELED'
        AND p."issueDate"<=COALESCE(NULLIF($1,'')::date,CURRENT_DATE)
       LEFT JOIN LATERAL (SELECT COALESCE(SUM(sp.amount),0) AS amount FROM supplier_payments sp
         WHERE sp."purchaseInvoiceId"=p.id AND sp.date<=COALESCE(NULLIF($1,'')::date,CURRENT_DATE)) paid ON true
       GROUP BY s.id ORDER BY s.name`, [asOf],
  )).rows;
}
