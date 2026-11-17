import type { Pool, PoolClient } from "pg";
import { ready } from "@/lib/accounting/db";
import { auth } from '@/lib/auth';
import { syncPaidPayrollToRef } from './payroll-ref';
import { defaultVatRegimeReason, isVatRateAllowedForDate, isVatRegimeCode, suggestVatRegime, vatRegimeNeedsReason, type VatRegimeCode } from "@/lib/accounting/vat-regime";

export type RefTransactionType = "INCOME" | "EXPENSE";
export type RefFiscalCategory =
  | "TAXABLE_INCOME"
  | "NON_TAXABLE_INCOME"
  | "DEDUCTIBLE_EXPENSE"
  | "PARTIAL_EXPENSE"
  | "NON_DEDUCTIBLE_EXPENSE";

export type RefTransaction = {
  id: number;
  type: RefTransactionType;
  date: string;
  documentType: string;
  documentNumber: string;
  explanation: string;
  grossAmount: number;
  vatAmount: number;
  vatRate: number | null;
  vatCategoryCode: VatRegimeCode;
  taxExemptionReasonCode: string;
  taxExemptionReason: string;
  netAmount: number;
  fiscalCategory: RefFiscalCategory;
  deductibilityPercent: number;
  fiscalAmount: number;
  invoiceId: number | null;
  paymentId: number | null;
  supplierPaymentId: number | null;
  source: "MANUAL" | "AUTO_PAYMENT" | "AUTO_PAYROLL" | "AUTO_SUPPLIER_PAYMENT";
  partnerName: string;
  partnerCif: string;
  partnerCountryCode: string;
  partnerVatPayer: number;
  partnerRegCom: string;
  partnerAddress: string;
  partnerCounty: string;
  partnerCity: string;
  partnerPostalCode: string;
  partnerPhone: string;
  partnerRegistrationStatus: string;
  partnerInactive: number;
  notes: string;
  createdAt: string;
};

export type RefSummary = {
  totalIncome: number;
  taxableIncome: number;
  totalExpenses: number;
  deductibleExpenses: number;
  fiscalResult: number;
};

export type RefTransactionInput = {
  type: RefTransactionType;
  date: string;
  documentType: string;
  documentNumber?: string;
  explanation: string;
  grossAmount: number;
  vatAmount?: number;
  vatRate?: number | null;
  vatCategoryCode?: VatRegimeCode;
  taxExemptionReasonCode?: string;
  taxExemptionReason?: string;
  fiscalCategory: RefFiscalCategory;
  deductibilityPercent?: number;
  notes?: string;
  partnerName?: string;
  partnerCif?: string;
  partnerCountryCode?: string;
  partnerVatPayer?: number;
  partnerRegCom?: string;
  partnerAddress?: string;
  partnerCounty?: string;
  partnerCity?: string;
  partnerPostalCode?: string;
  partnerPhone?: string;
  partnerRegistrationStatus?: string;
  partnerInactive?: number;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const normalizeRefCif = (value: unknown) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^RO/, "");
const normalizeRefName = (value: unknown) => String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
const normalizeRefDocument = (value: unknown) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function isEquivalentSupplierPaymentRefCandidate(candidate: Record<string, unknown>, payment: Record<string, unknown>) {
  const paymentCif = normalizeRefCif(payment.partnerCif);
  const partnerMatches = paymentCif
    ? normalizeRefCif(candidate.partnerCif) === paymentCif
    : Boolean(normalizeRefName(payment.partnerName)) && normalizeRefName(candidate.partnerName) === normalizeRefName(payment.partnerName);
  const paymentDocument = normalizeRefDocument(payment.documentNumber);
  return partnerMatches && (!paymentDocument || normalizeRefDocument(candidate.documentNumber) === paymentDocument);
}

export function isWeakSupplierPaymentRefCandidate(candidate: Record<string, unknown>, payment: Record<string, unknown>) {
  const paymentCif = normalizeRefCif(payment.partnerCif);
  const candidateCif = normalizeRefCif(candidate.partnerCif);
  const paymentName = normalizeRefName(payment.partnerName);
  const candidateName = normalizeRefName(candidate.partnerName);
  const paymentDocument = normalizeRefDocument(payment.documentNumber);
  const candidateDocument = normalizeRefDocument(candidate.documentNumber);
  const partnerConflict = paymentCif && candidateCif
    ? paymentCif !== candidateCif
    : Boolean(paymentName && candidateName && paymentName !== candidateName);
  const documentConflict = Boolean(paymentDocument && candidateDocument && paymentDocument !== candidateDocument);
  const compatibleIdentity = Boolean(
    (paymentCif && candidateCif && paymentCif === candidateCif)
    || (paymentName && candidateName && paymentName === candidateName)
    || (paymentDocument && candidateDocument && paymentDocument === candidateDocument)
  );
  return !partnerConflict && !documentConflict && compatibleIdentity;
}

function mapTransaction(row: Record<string, unknown>): RefTransaction {
  return {
    ...(row as unknown as RefTransaction),
    date: String(row.date).slice(0, 10),
    grossAmount: Number(row.grossAmount),
    vatAmount: Number(row.vatAmount),
    vatRate: row.vatRate == null ? null : Number(row.vatRate),
    netAmount: Number(row.netAmount),
    deductibilityPercent: Number(row.deductibilityPercent),
    fiscalAmount: Number(row.fiscalAmount),
  };
}

export async function getRefVatPayer(): Promise<boolean> {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT "vatPayer" FROM company WHERE id=1`);
  return Boolean(Number(rows[0]?.vatPayer || 0));
}

export function calculateRefFiscalAmount(input: {
  type: RefTransactionType;
  category: RefFiscalCategory;
  grossAmount: number;
  vatAmount: number;
  vatPayer: boolean;
  deductibilityPercent?: number;
}) {
  const gross = round2(input.grossAmount);
  const vat = round2(input.vatAmount);
  const net = round2(gross - vat);
  const base = input.vatPayer ? net : gross;

  if (input.type === "INCOME") {
    return input.category === "TAXABLE_INCOME" ? round2(base) : 0;
  }
  if (input.category === "NON_DEDUCTIBLE_EXPENSE") return 0;
  const percent = input.category === "PARTIAL_EXPENSE"
    ? Math.min(100, Math.max(0, Number(input.deductibilityPercent ?? 50)))
    : 100;
  return round2(base * percent / 100);
}

function validateInput(input: RefTransactionInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Data înregistrării este obligatorie.");
  if (!input.documentType.trim()) throw new Error("Tipul documentului este obligatoriu.");
  if (!input.explanation.trim()) throw new Error("Explicația este obligatorie.");
  if (!Number.isFinite(input.grossAmount) || input.grossAmount <= 0) throw new Error("Suma brută trebuie să fie pozitivă.");
  const vat = Number(input.vatAmount || 0);
  if (!Number.isFinite(vat) || vat < 0 || vat > input.grossAmount) throw new Error("Valoarea TVA este invalidă.");
  if (input.vatCategoryCode && !isVatRegimeCode(input.vatCategoryCode)) throw new Error("Regimul TVA selectat nu este valid.");
  if (input.vatRate != null && Number(input.vatRate) !== 0 && !isVatRateAllowedForDate(Number(input.vatRate), input.date)) throw new Error("Cota TVA nu este valabilă la data documentului.");
  if (input.partnerCountryCode && !/^[A-Za-z]{2}$/.test(input.partnerCountryCode.trim())) throw new Error("Codul țării partenerului trebuie să aibă două litere.");
  const incomeCategories = ["TAXABLE_INCOME", "NON_TAXABLE_INCOME"];
  const expenseCategories = ["DEDUCTIBLE_EXPENSE", "PARTIAL_EXPENSE", "NON_DEDUCTIBLE_EXPENSE"];
  if (input.type === "INCOME" && !incomeCategories.includes(input.fiscalCategory)) throw new Error("Categoria fiscală nu corespunde unui venit.");
  if (input.type === "EXPENSE" && !expenseCategories.includes(input.fiscalCategory)) throw new Error("Categoria fiscală nu corespunde unei cheltuieli.");
}

export async function createRefTransaction(input: RefTransactionInput): Promise<number> {
  validateInput(input);
  const pool = await ready();
  const vatPayer = await getRefVatPayer();
  const gross = round2(Number(input.grossAmount));
  const vat = round2(Number(input.vatAmount || 0));
  const net = round2(gross - vat);
  const vatRate = input.vatRate == null ? null : Number(input.vatRate);
  const domesticNonVatSupplier = input.type === "EXPENSE" && (input.partnerCountryCode?.trim().toUpperCase() || "RO") === "RO" && Number(input.partnerVatPayer) === 0;
  const vatCategoryCode = input.vatCategoryCode || suggestVatRegime({ type: input.type, companyVatPayer: vatPayer, partnerVatPayer: domesticNonVatSupplier ? false : undefined, vatAmount: vat, vatRate: vatRate || 0 });
  const taxExemptionReasonCode = input.taxExemptionReasonCode?.trim() || "";
  const taxExemptionReason = input.taxExemptionReason?.trim() || defaultVatRegimeReason(vatCategoryCode);
  if (vatCategoryCode === "S" && vat <= 0) throw new Error("Regimul standard necesită o valoare TVA pozitivă.");
  if (vatCategoryCode !== "S" && vat > 0) throw new Error("Pentru regimul TVA selectat, valoarea TVA trebuie să fie zero.");
  if (vatRegimeNeedsReason(vatCategoryCode) && !taxExemptionReason && !taxExemptionReasonCode) throw new Error("Completează motivul legal pentru regimul TVA selectat.");
  if ((vatCategoryCode === "S" || vatCategoryCode === "AE") && (!vatRate || vatRate <= 0)) throw new Error("Cota TVA este obligatorie pentru regimul selectat.");
  if (vatCategoryCode === "S" && vatRate != null && Math.abs(vat - round2(net * vatRate / 100)) > 0.05) throw new Error("TVA-ul nu corespunde cotei selectate și bazei documentului.");
  const percent = input.fiscalCategory === "PARTIAL_EXPENSE"
    ? Math.min(100, Math.max(0, Number(input.deductibilityPercent ?? 50)))
    : input.fiscalCategory === "NON_DEDUCTIBLE_EXPENSE" ? 0 : 100;
  const fiscalAmount = calculateRefFiscalAmount({
    type: input.type,
    category: input.fiscalCategory,
    grossAmount: gross,
    vatAmount: vat,
    vatPayer,
    deductibilityPercent: percent,
  });
  const { rows } = await pool.query(
    `INSERT INTO ref_transactions
      (type, date, "documentType", "documentNumber", explanation, "grossAmount", "vatAmount", "netAmount",
       "fiscalCategory", "deductibilityPercent", "fiscalAmount", source, notes, "partnerName", "partnerCif", "partnerCountryCode", "vatRate", "partnerVatPayer",
       "partnerRegCom","partnerAddress","partnerCounty","partnerCity","partnerPostalCode","partnerPhone","partnerRegistrationStatus","partnerInactive",
       "vatCategoryCode","taxExemptionReasonCode","taxExemptionReason")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'MANUAL',$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING id`,
    [input.type, input.date, input.documentType.trim(), input.documentNumber?.trim() || "", input.explanation.trim(),
      gross, vat, net, input.fiscalCategory, percent, fiscalAmount, input.notes?.trim() || "",
      input.partnerName?.trim() || "", input.partnerCif?.trim().toUpperCase() || "", input.partnerCountryCode?.trim().toUpperCase() || "RO", vatRate, Number(input.partnerVatPayer??-1),
      input.partnerRegCom?.trim() || "", input.partnerAddress?.trim() || "", input.partnerCounty?.trim() || "", input.partnerCity?.trim() || "",
      input.partnerPostalCode?.trim() || "", input.partnerPhone?.trim() || "", input.partnerRegistrationStatus?.trim() || "", Number(input.partnerInactive || 0),
      vatCategoryCode, taxExemptionReasonCode, taxExemptionReason]
  );
  return Number(rows[0].id);
}

export async function createRefIncomeForPayment(input: {
  paymentId: number;
  invoiceId: number;
  date: string;
  amount: number;
  invoiceTotal: number;
  invoiceSubtotal: number;
  series: string;
  number: number;
  clientName: string;
}, client?: PoolClient) {
  const executor = client || await ready();
  const invoiceRow = (await executor.query(`SELECT "exchangeRate" FROM invoices WHERE id=$1`, [input.invoiceId])).rows[0];
  if (!invoiceRow) throw new Error("Factura încasării nu există.");
  const companyResult = await executor.query(`SELECT "vatPayer" FROM company WHERE id=1`);
  const vatPayer = Boolean(Number(companyResult.rows[0]?.vatPayer || 0));
  const gross = round2(input.amount * Number(invoiceRow.exchangeRate || 1));
  const net = vatPayer && input.invoiceTotal > 0
    ? round2(gross * input.invoiceSubtotal / input.invoiceTotal)
    : gross;
  const vat = round2(gross - net);
  const fiscalAmount = vatPayer ? net : gross;
  const partnerRow = (await executor.query(
    `SELECT c.*,i."clientSnapshot" AS "__clientSnapshot"
       FROM invoices i JOIN clients c ON c.id=i."clientId" WHERE i.id=$1`,
    [input.invoiceId],
  )).rows[0] || {};
  const snapshot = partnerRow.__clientSnapshot && typeof partnerRow.__clientSnapshot === "object"
    ? partnerRow.__clientSnapshot as Record<string, unknown>
    : {};
  const partner = Object.keys(snapshot).length ? snapshot : partnerRow;
  await executor.query(
    `INSERT INTO ref_transactions
      (type, date, "documentType", "documentNumber", explanation, "grossAmount", "vatAmount", "netAmount",
       "fiscalCategory", "deductibilityPercent", "fiscalAmount", "invoiceId", "paymentId", source,
       "partnerName","partnerCif","partnerCountryCode","partnerVatPayer","partnerRegCom","partnerAddress","partnerCounty","partnerCity","partnerPostalCode","partnerPhone",
       "vatCategoryCode","taxExemptionReasonCode","taxExemptionReason")
     VALUES ('INCOME',$1,'FACTURA',$2,$3,$4,$5,$6,'TAXABLE_INCOME',100,$7,$8,$9,'AUTO_PAYMENT',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     ON CONFLICT ("paymentId") WHERE "paymentId" IS NOT NULL DO NOTHING`,
    [input.date, `${input.series} ${input.number}`, `Încasare factură – ${input.clientName}`, gross, vat, net,
      fiscalAmount, input.invoiceId, input.paymentId, String(partner.name || input.clientName), String(partner.cif || ""), String(partner.countryCode || "RO"), Number(partner.vatPayer || 0),
      String(partner.regCom || ""), String(partner.address || ""), String(partner.judet || ""), String(partner.city || ""), String(partner.postalCode || ""), String(partner.phone || ""),
      suggestVatRegime({ type: "INCOME", companyVatPayer: vatPayer, vatAmount: vat }), "", defaultVatRegimeReason(suggestVatRegime({ type: "INCOME", companyVatPayer: vatPayer, vatAmount: vat }))]
  );
}

export type SupplierPaymentRefSyncResult = {
  paymentId: number;
  date: string;
  status: "CREATED" | "LINKED_MANUAL" | "EXISTING" | "UNRESOLVED";
  manualMatches: number;
  weakManualMatches: number;
  duplicateManualWithAutomatic: boolean;
};

export async function createRefExpenseForSupplierPayment(paymentId: number, client?: Pool | PoolClient): Promise<SupplierPaymentRefSyncResult> {
  const executor = client || await ready();
  const payment = (await executor.query(
    `SELECT sp.id,sp.date::text AS date,sp.amount,p."documentType",p."documentNumber",p.total,p."exchangeRate",p."reverseCharge",
            s.name AS "partnerName",s.cif AS "partnerCif",s."countryCode" AS "partnerCountryCode",s."vatPayer" AS "partnerVatPayer",
            s."regCom" AS "partnerRegCom",s.address AS "partnerAddress",s.county AS "partnerCounty",s.city AS "partnerCity",
            s."postalCode" AS "partnerPostalCode",s.phone AS "partnerPhone",
            COALESCE(SUM(i."vatAmount"),0)::float8 AS "invoiceVat",
            COALESCE(SUM(i."netAmount"+i."vatAmount"-i."vatAmount"*i."deductibilityPercent"/100),0)::float8 AS "expenseBase",
            MIN(i."vatRate")::float8 AS "minimumVatRate",MAX(i."vatRate")::float8 AS "maximumVatRate"
       FROM supplier_payments sp JOIN purchase_invoices p ON p.id=sp."purchaseInvoiceId"
       JOIN suppliers s ON s.id=p."supplierId" LEFT JOIN purchase_invoice_items i ON i."purchaseInvoiceId"=p.id
      WHERE sp.id=$1
       GROUP BY sp.id,sp.date,sp.amount,p."documentType",p."documentNumber",p.total,p."exchangeRate",p."reverseCharge",
               s.name,s.cif,s."countryCode",s."vatPayer",s."regCom",s.address,s.county,s.city,s."postalCode",s.phone`,
    [paymentId],
  )).rows[0];
  if (!payment) throw new Error("Plata furnizorului nu există pentru registrul fiscal.");
  const invoiceTotal = Number(payment.total);
  if (!Number.isFinite(invoiceTotal) || invoiceTotal <= 0) throw new Error("Totalul facturii furnizorului nu este valid.");
  const proportion = Number(payment.amount) / invoiceTotal;
  const rate = Number(payment.exchangeRate || 1);
  const gross = round2(Number(payment.amount) * rate);
  const reverseCharge = Boolean(Number(payment.reverseCharge));
  const vat = reverseCharge ? 0 : round2(Number(payment.invoiceVat || 0) * proportion * rate);
  const net = reverseCharge ? gross : round2(gross - vat);
  const fiscalAmount = round2(Number(payment.expenseBase || 0) * proportion * rate);
  const uniformVatRate = Number(payment.minimumVatRate) === Number(payment.maximumVatRate) && (vat > 0 || reverseCharge)
    ? Number(payment.minimumVatRate)
    : null;
  const vatCategoryCode: VatRegimeCode = reverseCharge ? "AE" : vat > 0 ? "S" : "Z";
  const taxExemptionReason = reverseCharge ? defaultVatRegimeReason("AE") : "";
  const marker = `[supplier-payment:${paymentId}]`;
  const legacyMarker = `Plată furnizor #${paymentId}`;
  const canonicalizeRow = (rowId: number, manualOnly: boolean) => executor.query(
    `UPDATE ref_transactions SET
       "supplierPaymentId"=$1,source='AUTO_SUPPLIER_PAYMENT',
       notes=CASE WHEN trim(notes)='' OR notes LIKE 'Plată furnizor #%'
                  THEN $2 WHEN position($2 in notes)>0 THEN notes
                  ELSE $2 || E'\n[notă manuală anterioară] ' || notes END,
       date=$4,"documentType"=$5,"documentNumber"=$6,explanation=$7,
       "grossAmount"=$8,"vatAmount"=$9,"netAmount"=$10,
       "fiscalCategory"='DEDUCTIBLE_EXPENSE',"deductibilityPercent"=100,"fiscalAmount"=$11,
       "partnerName"=$12,"partnerCif"=$13,"partnerCountryCode"=$14,"partnerVatPayer"=$15,
       "partnerRegCom"=$16,"partnerAddress"=$17,"partnerCounty"=$18,"partnerCity"=$19,
       "partnerPostalCode"=$20,"partnerPhone"=$21,"vatRate"=$22,"vatCategoryCode"=$23,
       "taxExemptionReasonCode"='',"taxExemptionReason"=$24
     WHERE id=$3 AND "supplierPaymentId" IS NULL${manualOnly ? " AND source='MANUAL'" : ""}`,
    [paymentId, marker, rowId, payment.date, payment.documentType || "FACTURA", payment.documentNumber || "",
      `Plată furnizor - ${payment.partnerName || "Furnizor"}`, gross, vat, net, fiscalAmount,
      payment.partnerName || "", payment.partnerCif || "", payment.partnerCountryCode || "RO", Number(payment.partnerVatPayer || 0),
      payment.partnerRegCom || "", payment.partnerAddress || "", payment.partnerCounty || "", payment.partnerCity || "",
      payment.partnerPostalCode || "", payment.partnerPhone || "", uniformVatRate, vatCategoryCode, taxExemptionReason],
  );
  const existing = (await executor.query(
    `SELECT id,source,"supplierPaymentId" FROM ref_transactions
      WHERE "supplierPaymentId"=$1
         OR (source='AUTO_SUPPLIER_PAYMENT' AND notes IN ($2,$3))
      ORDER BY CASE WHEN "supplierPaymentId"=$1 THEN 0 ELSE 1 END,id
      LIMIT 1`,
    [paymentId, marker, legacyMarker],
  )).rows[0];
  const manualCandidates = (await executor.query(
    `SELECT id,"partnerCif","partnerName","documentNumber" FROM ref_transactions
      WHERE source='MANUAL' AND type='EXPENSE' AND date=$1::date
        AND ABS("grossAmount"-$2::numeric)<=0.01
        AND "supplierPaymentId" IS NULL
      ORDER BY id`,
    [payment.date, gross],
  )).rows;
  const strictManualMatches = manualCandidates.filter((candidate) => isEquivalentSupplierPaymentRefCandidate(candidate, payment));
  const weakManualMatches = manualCandidates.filter((candidate) => !isEquivalentSupplierPaymentRefCandidate(candidate, payment) && isWeakSupplierPaymentRefCandidate(candidate, payment));
  const manualMatches = [...strictManualMatches, ...weakManualMatches];
  if (existing) {
    if (!existing.supplierPaymentId) await canonicalizeRow(Number(existing.id), false);
    return { paymentId, date: String(payment.date).slice(0, 10), status: manualMatches.length ? "UNRESOLVED" : "EXISTING", manualMatches: manualMatches.length, weakManualMatches: weakManualMatches.length, duplicateManualWithAutomatic: manualMatches.length > 0 };
  }
  if (strictManualMatches.length === 1 && weakManualMatches.length === 0) {
    const linked = await canonicalizeRow(Number(strictManualMatches[0].id), true);
    if (linked.rowCount === 1) return { paymentId, date: String(payment.date).slice(0, 10), status: "LINKED_MANUAL", manualMatches: 1, weakManualMatches: 0, duplicateManualWithAutomatic: false };
  }
  const inserted = await executor.query(
    `INSERT INTO ref_transactions
      (type,date,"documentType","documentNumber",explanation,"grossAmount","vatAmount","netAmount",
       "fiscalCategory","deductibilityPercent","fiscalAmount",source,notes,
       "partnerName","partnerCif","partnerCountryCode","partnerVatPayer","partnerRegCom","partnerAddress",
       "partnerCounty","partnerCity","partnerPostalCode","partnerPhone","vatRate","vatCategoryCode","taxExemptionReason","supplierPaymentId")
     SELECT 'EXPENSE',$1,$2,$3,$4,$5,$6,$7,'DEDUCTIBLE_EXPENSE',100,$8,'AUTO_SUPPLIER_PAYMENT',$9,
            $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      ON CONFLICT ("supplierPaymentId") WHERE "supplierPaymentId" IS NOT NULL DO NOTHING
      RETURNING id`,
    [payment.date, payment.documentType || "FACTURA", payment.documentNumber || "", `Plată furnizor - ${payment.partnerName || "Furnizor"}`,
      gross, vat, net, fiscalAmount, marker, payment.partnerName || "", payment.partnerCif || "",
      payment.partnerCountryCode || "RO", Number(payment.partnerVatPayer || 0), payment.partnerRegCom || "",
      payment.partnerAddress || "", payment.partnerCounty || "", payment.partnerCity || "", payment.partnerPostalCode || "",
      payment.partnerPhone || "", uniformVatRate, vatCategoryCode, taxExemptionReason, paymentId],
  );
  const unresolved = strictManualMatches.length > 1 || weakManualMatches.length > 0;
  return { paymentId, date: String(payment.date).slice(0, 10), status: unresolved ? "UNRESOLVED" : inserted.rowCount ? "CREATED" : "EXISTING", manualMatches: manualMatches.length, weakManualMatches: weakManualMatches.length, duplicateManualWithAutomatic: false };
}

export async function syncSupplierPaymentsToRef(executor: Pool | PoolClient, options: { paymentId?: number; year?: number } = {}) {
  const clauses: string[] = [];
  const params: number[] = [];
  if (options.paymentId != null) {
    params.push(options.paymentId);
    clauses.push(`sp.id=$${params.length}`);
  }
  if (options.year != null) {
    params.push(options.year);
    clauses.push(`EXTRACT(YEAR FROM sp.date)=$${params.length}`);
  }
  const { rows } = await executor.query(
    `SELECT sp.id FROM supplier_payments sp
      WHERE ${clauses.length ? `${clauses.join(" AND ")} AND ` : ""}
        NOT EXISTS (SELECT 1 FROM ref_transactions r WHERE r."supplierPaymentId"=sp.id)
      ORDER BY sp.date,sp.id`,
    params,
  );
  const results: SupplierPaymentRefSyncResult[] = [];
  for (const row of rows) results.push(await createRefExpenseForSupplierPayment(Number(row.id), executor));
  const processed = new Set(results.map((result) => result.paymentId));
  const unresolved = await executor.query(
    `SELECT sp.id AS "paymentId",sp.date::text AS date,ROUND(sp.amount*p."exchangeRate",2)::float8 AS "grossAmount",
            s.name AS "partnerName",s.cif AS "partnerCif",p."documentNumber",
            m.id AS "manualId",m."partnerName" AS "manualPartnerName",m."partnerCif" AS "manualPartnerCif",m."documentNumber" AS "manualDocumentNumber"
       FROM supplier_payments sp
       JOIN purchase_invoices p ON p.id=sp."purchaseInvoiceId"
       JOIN suppliers s ON s.id=p."supplierId"
       JOIN ref_transactions linked ON linked."supplierPaymentId"=sp.id
       JOIN ref_transactions m ON m.source='MANUAL' AND m.type='EXPENSE' AND m."supplierPaymentId" IS NULL
        AND m.date=sp.date AND ABS(m."grossAmount"-ROUND(sp.amount*p."exchangeRate",2))<=0.01
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY sp.id,m.id`,
    params,
  );
  const unresolvedByPayment = new Map<number, { date: string; ids: Set<number>; weakIds: Set<number> }>();
  for (const row of unresolved.rows) {
    const paymentId = Number(row.paymentId);
    const candidate = { partnerName: row.manualPartnerName, partnerCif: row.manualPartnerCif, documentNumber: row.manualDocumentNumber };
    const strictMatch = isEquivalentSupplierPaymentRefCandidate(candidate, row);
    const weakMatch = !strictMatch && isWeakSupplierPaymentRefCandidate(candidate, row);
    if (processed.has(paymentId) || (!strictMatch && !weakMatch)) continue;
    const unresolvedPayment = unresolvedByPayment.get(paymentId) || { date: String(row.date).slice(0, 10), ids: new Set<number>(), weakIds: new Set<number>() };
    unresolvedPayment.ids.add(Number(row.manualId));
    if (weakMatch) unresolvedPayment.weakIds.add(Number(row.manualId));
    unresolvedByPayment.set(paymentId, unresolvedPayment);
  }
  for (const [paymentId, unresolvedPayment] of unresolvedByPayment) {
    results.push({ paymentId, date: unresolvedPayment.date, status: "UNRESOLVED", manualMatches: unresolvedPayment.ids.size, weakManualMatches: unresolvedPayment.weakIds.size, duplicateManualWithAutomatic: true });
  }
  return results;
}

export async function listRefTransactions(year: number): Promise<RefTransaction[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    `SELECT r.*,r.date::text AS date FROM ref_transactions r WHERE EXTRACT(YEAR FROM r.date)=$1 ORDER BY r.date,r.id`,
    [year]
  );
  return rows.map(mapTransaction);
}

export function summarizeRefTransactions(rows: RefTransaction[]): RefSummary {
  const summary = rows.reduce((acc, row) => {
    if (row.type === "INCOME") {
      acc.totalIncome += row.grossAmount;
      acc.taxableIncome += row.fiscalAmount;
    } else {
      acc.totalExpenses += row.grossAmount;
      acc.deductibleExpenses += row.fiscalAmount;
    }
    return acc;
  }, { totalIncome: 0, taxableIncome: 0, totalExpenses: 0, deductibleExpenses: 0 });
  return {
    totalIncome: round2(summary.totalIncome),
    taxableIncome: round2(summary.taxableIncome),
    totalExpenses: round2(summary.totalExpenses),
    deductibleExpenses: round2(summary.deductibleExpenses),
    fiscalResult: round2(summary.taxableIncome - summary.deductibleExpenses),
  };
}

export type RefAccountSummary = {
  accountCode: string;
  accountName: string;
  type: "INCOME" | "EXPENSE";
  debit: number;
  credit: number;
  accountingAmount: number;
  /** @deprecated Compatibility for already open clients; this is a journal amount, not a fiscal classification. */
  fiscalAmount?: number;
  entries: number;
};

export async function listRefAccountSummary(year: number): Promise<RefAccountSummary[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    `SELECT a.code AS "accountCode",a.name AS "accountName",
            CASE WHEN a.code LIKE '7%' THEN 'INCOME' ELSE 'EXPENSE' END AS type,
            ROUND(SUM(l.debit)::numeric,2) AS debit,ROUND(SUM(l.credit)::numeric,2) AS credit,
            ROUND(CASE WHEN a.code LIKE '7%' THEN SUM(l.credit-l.debit) ELSE SUM(l.debit-l.credit) END::numeric,2) AS "accountingAmount",
            COUNT(DISTINCT e.id)::int AS entries
       FROM journal_lines l JOIN journal_entries e ON e.id=l."entryId"
       JOIN accounting_accounts a ON a.code=l."accountCode"
      WHERE e.status='POSTED' AND EXTRACT(YEAR FROM e.date)=$1 AND (a.code LIKE '6%' OR a.code LIKE '7%')
      GROUP BY a.code,a.name ORDER BY a.code`, [year]
  );
  return rows.map((row)=>({...row,debit:Number(row.debit),credit:Number(row.credit),accountingAmount:Number(row.accountingAmount),fiscalAmount:Number(row.accountingAmount),entries:Number(row.entries)}));
}
export async function getRefReport(year: number) {
  const session = await auth();
  const businessId = (session as { businessId?: string } | null)?.businessId;
  const pool = await ready();
  if (businessId) await syncPaidPayrollToRef(pool,businessId,{year});
  const supplierSync = await syncSupplierPaymentsToRef(pool,{year});
  const transactions = await listRefTransactions(year);
  const warnings = supplierSync.flatMap((result) => {
    if (result.status === "UNRESOLVED" && result.weakManualMatches) return [`Plata furnizorului #${result.paymentId} seamănă cu o poziție manuală cu date de identificare incomplete. Nu s-a făcut legarea automată; completează furnizorul/documentul și reconciliază manual.`];
    if (result.duplicateManualWithAutomatic) return [`Plata furnizorului #${result.paymentId} are deja o poziție automată și cel puțin o poziție manuală echivalentă. Nu s-a șters nimic; verifică manual dublarea.`];
    if (result.manualMatches > 1) return [`Plata furnizorului #${result.paymentId} are ${result.manualMatches} poziții manuale echivalente. Potrivirea este ambiguă; nu s-a modificat și nu s-a șters nicio poziție manuală.`];
    return [];
  });
  return { transactions, accountSummary: await listRefAccountSummary(year), summary: summarizeRefTransactions(transactions), vatPayer: await getRefVatPayer(), warnings };
}

export async function deleteRefTransaction(id: number) {
  const pool = await ready();
  const { rowCount } = await pool.query(`DELETE FROM ref_transactions WHERE id=$1 AND source='MANUAL' AND "supplierPaymentId" IS NULL`, [id]);
  if (!rowCount) throw new Error("Înregistrările generate automat din încasări nu pot fi șterse manual.");
}
