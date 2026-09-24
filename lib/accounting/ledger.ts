import type { PoolClient } from "pg";
import { ready } from "./db";

export type AccountNature = "DEBIT" | "CREDIT" | "BOTH" | "GROUP";

export type JournalLineInput = {
  accountCode: string;
  debit?: number;
  credit?: number;
  explanation?: string;
  partnerId?: number | null;
  supplierId?: number | null;
};

export type JournalEntryInput = {
  date: string;
  description: string;
  documentNumber?: string;
  sourceType?: string;
  sourceId?: number | null;
  sourceKey?: string | null;
  createdBy?: string;
  lines: JournalLineInput[];
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function assertOpenPeriod(client: PoolClient, date: string) {
  if (!validDate(date)) throw new Error("Data articolului contabil nu este validă.");
  const [year, month] = date.split("-").map(Number);
  const { rows } = await client.query(
    `SELECT status FROM accounting_periods WHERE year=$1 AND month=$2`,
    [year, month],
  );
  if (rows[0]?.status === "CLOSED") {
    throw new Error(`Perioada ${String(month).padStart(2, "0")}/${year} este închisă.`);
  }
}

async function validateLines(client: PoolClient, lines: JournalLineInput[]) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error("Articolul contabil trebuie să conțină cel puțin două linii.");
  }
  const normalized = lines.map((line) => ({
    ...line,
    accountCode: String(line.accountCode || "").trim(),
    debit: round2(Number(line.debit || 0)),
    credit: round2(Number(line.credit || 0)),
  }));
  for (const [index, line] of normalized.entries()) {
    if (!line.accountCode) throw new Error(`Linia ${index + 1}: selectează contul.`);
    if (!Number.isFinite(line.debit) || !Number.isFinite(line.credit) || line.debit < 0 || line.credit < 0) {
      throw new Error(`Linia ${index + 1}: sumele nu sunt valide.`);
    }
    if ((line.debit > 0) === (line.credit > 0)) {
      throw new Error(`Linia ${index + 1}: completează exclusiv debitul sau creditul.`);
    }
  }
  const debit = round2(normalized.reduce((sum, line) => sum + line.debit, 0));
  const credit = round2(normalized.reduce((sum, line) => sum + line.credit, 0));
  if (debit <= 0 || Math.abs(debit - credit) > 0.009) {
    throw new Error(`Articol dezechilibrat: debit ${debit.toFixed(2)}, credit ${credit.toFixed(2)}.`);
  }
  const codes = [...new Set(normalized.map((line) => line.accountCode))];
  const { rows } = await client.query(
    `SELECT code,active,"allowPosting" FROM accounting_accounts WHERE code=ANY($1::text[])`,
    [codes],
  );
  const accounts = new Map(rows.map((row) => [row.code, row]));
  for (const code of codes) {
    const account = accounts.get(code);
    if (!account) throw new Error(`Contul ${code} nu există în planul de conturi.`);
    if (!account.active) throw new Error(`Contul ${code} este inactiv.`);
    if (!account.allowPosting) throw new Error(`Contul ${code} este sintetic și nu permite postare.`);
  }
  return normalized;
}

async function insertEntry(client: PoolClient, input: JournalEntryInput) {
  await assertOpenPeriod(client, input.date);
  const lines = await validateLines(client, input.lines);
  const year = Number(input.date.slice(0, 4));
  const description = String(input.description || "").trim();
  if (!description) throw new Error("Completează explicația articolului contabil.");
  const { rows: numberRows } = await client.query(
    `INSERT INTO accounting_counters (year,"lastNumber") VALUES ($1,1)
     ON CONFLICT (year) DO UPDATE SET "lastNumber"=accounting_counters."lastNumber"+1
     RETURNING "lastNumber"`,
    [year],
  );
  const { rows } = await client.query(
    `INSERT INTO journal_entries
       ("entryNumber",year,date,description,"documentNumber","sourceType","sourceId","sourceKey","createdBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      Number(numberRows[0].lastNumber),
      year,
      input.date,
      description,
      String(input.documentNumber || "").trim(),
      String(input.sourceType || "MANUAL").trim().toUpperCase(),
      input.sourceId ?? null,
      input.sourceKey ?? null,
      String(input.createdBy || "").trim(),
    ],
  );
  const entryId = Number(rows[0].id);
  for (const [index, line] of lines.entries()) {
    await client.query(
      `INSERT INTO journal_lines
         ("entryId","lineNumber","accountCode",debit,credit,explanation,"partnerId","supplierId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [entryId, index + 1, line.accountCode, line.debit, line.credit, line.explanation || "", line.partnerId ?? null, line.supplierId ?? null],
    );
  }
  return entryId;
}

export async function postPayrollToLedger(input: {
  runId: string;
  month: string;
  gross: number;
  cas: number;
  cass: number;
  incomeTax: number;
  cam: number;
  otherDeductions: number;
  advancePaid: number;
  createdBy?: string;
}) {
  const connection = await (await ready()).connect();
  try {
    await connection.query("BEGIN");
    const [year, month] = input.month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    await assertOpenPeriod(connection, lastDay);
    await connection.query(
      `DELETE FROM journal_entries WHERE "sourceType"='PAYROLL' AND "sourceKey"=$1`,
      [input.runId],
    );
    const lines: JournalLineInput[] = [
      { accountCode: "641", debit: round2(input.gross), explanation: `Cheltuieli salariale ${input.month}` },
      { accountCode: "421", credit: round2(input.gross), explanation: `Salarii datorate ${input.month}` },
      { accountCode: "421", debit: round2(input.cas), explanation: `CAS reținut ${input.month}` },
      { accountCode: "4315", credit: round2(input.cas), explanation: `CAS datorat ${input.month}` },
      { accountCode: "421", debit: round2(input.cass), explanation: `CASS reținut ${input.month}` },
      { accountCode: "4316", credit: round2(input.cass), explanation: `CASS datorat ${input.month}` },
      { accountCode: "421", debit: round2(input.incomeTax), explanation: `Impozit salarii ${input.month}` },
      { accountCode: "444", credit: round2(input.incomeTax), explanation: `Impozit salarii datorat ${input.month}` },
      { accountCode: "421", debit: round2(input.otherDeductions), explanation: `Alte rețineri salariale ${input.month}` },
      { accountCode: "427", credit: round2(input.otherDeductions), explanation: `Rețineri datorate terților ${input.month}` },
      { accountCode: "421", debit: round2(input.advancePaid), explanation: `Avansuri salariale reținute ${input.month}` },
      { accountCode: "425", credit: round2(input.advancePaid), explanation: `Regularizare avansuri ${input.month}` },
      { accountCode: "6461", debit: round2(input.cam), explanation: `CAM ${input.month}` },
      { accountCode: "436", credit: round2(input.cam), explanation: `CAM datorată ${input.month}` },
    ].filter((line) => Number(line.debit || line.credit || 0) > 0);
    await insertEntry(connection, {
      date: lastDay,
      description: `Stat salarii ${input.month}`,
      documentNumber: `SAL-${input.month}`,
      sourceType: "PAYROLL",
      sourceKey: input.runId,
      createdBy: input.createdBy,
      lines,
    });
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

export async function createManualJournalEntry(input: JournalEntryInput) {
  const connection = await (await ready()).connect();
  try {
    await connection.query("BEGIN");
    const id = await insertEntry(connection, { ...input, sourceType: "MANUAL", sourceId: null });
    await connection.query("COMMIT");
    return id;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

function addSignedLines(
  lines: JournalLineInput[],
  debitAccount: string,
  creditAccount: string,
  amount: number,
  explanation: string,
  partnerId?: number | null,
) {
  const value = round2(Math.abs(amount));
  if (!value) return;
  if (amount >= 0) {
    lines.push({ accountCode: debitAccount, debit: value, explanation, partnerId });
    lines.push({ accountCode: creditAccount, credit: value, explanation, partnerId });
  } else {
    lines.push({ accountCode: creditAccount, debit: value, explanation, partnerId });
    lines.push({ accountCode: debitAccount, credit: value, explanation, partnerId });
  }
}

async function replaceAutomaticEntry(client: PoolClient, input: JournalEntryInput) {
  await assertOpenPeriod(client, input.date);
  await client.query(
    `DELETE FROM journal_entries WHERE "sourceType"=$1 AND "sourceId"=$2`,
    [input.sourceType, input.sourceId],
  );
  return insertEntry(client, input);
}

export async function postInvoiceToLedger(invoiceId: number, client: PoolClient) {
  const { rows: invoices } = await client.query(`SELECT * FROM invoices WHERE id=$1`, [invoiceId]);
  const invoice = invoices[0];
  if (!invoice) throw new Error("Factura nu există pentru contare.");
  const { rows: items } = await client.query(
    `SELECT * FROM invoice_items WHERE "invoiceId"=$1 ORDER BY id`,
    [invoiceId],
  );
  const rate = Number(invoice.exchangeRate || 1);
  const revenue = new Map<string, number>();
  for (const item of items) {
    const code = String(item.revenueAccount || "704");
    revenue.set(code, round2((revenue.get(code) || 0) + Number(item.valoare) * rate));
  }
  const lines: JournalLineInput[] = [];
  const reference = `${invoice.series} ${invoice.number}`;
  for (const [account, amount] of revenue) {
    addSignedLines(lines, "4111", account, amount, `Venit ${reference}`, Number(invoice.clientId));
  }
  addSignedLines(
    lines,
    "4111",
    "4427",
    round2(Number(invoice.vatTotal) * rate),
    `TVA colectată ${reference}`,
    Number(invoice.clientId),
  );
  return replaceAutomaticEntry(client, {
    date: invoice.issueDate,
    description: invoice.invoiceType === "STORNO" ? `Stornare factură ${reference}` : `Factură emisă ${reference}`,
    documentNumber: reference,
    sourceType: "INVOICE",
    sourceId: invoiceId,
    lines,
  });
}

export async function postPaymentToLedger(paymentId: number, client: PoolClient) {
  const { rows } = await client.query(
    `SELECT p.*,i.series,i.number,i."clientId",i."exchangeRate",c.name AS "clientName"
       FROM payments p JOIN invoices i ON i.id=p."invoiceId"
       LEFT JOIN clients c ON c.id=i."clientId" WHERE p.id=$1`,
    [paymentId],
  );
  const payment = rows[0];
  if (!payment) throw new Error("Încasarea nu există pentru contare.");
  const cash = ["cash", "numerar"].includes(String(payment.method).toLowerCase());
  const amount = round2(Number(payment.amount) * Number(payment.exchangeRate || 1));
  const reference = `${payment.series} ${payment.number}`;
  return replaceAutomaticEntry(client, {
    date: String(payment.date).slice(0, 10),
    description: `Încasare factură ${reference} - ${payment.clientName || "Client"}`,
    documentNumber: reference,
    sourceType: "PAYMENT",
    sourceId: paymentId,
    lines: [
      { accountCode: cash ? "5311" : "5121", debit: amount, explanation: `Încasare ${reference}`, partnerId: payment.clientId },
      { accountCode: "4111", credit: amount, explanation: `Stingere creanță ${reference}`, partnerId: payment.clientId },
    ],
  });
}

export async function postPurchaseInvoiceToLedger(purchaseId: number, client: PoolClient) {
  const { rows } = await client.query(
    `SELECT p.*,s.name AS "supplierName",s."analyticAccount"
       FROM purchase_invoices p JOIN suppliers s ON s.id=p."supplierId" WHERE p.id=$1`,
    [purchaseId],
  );
  const purchase = rows[0];
  if (!purchase) throw new Error("Factura de intrare nu există pentru contare.");
  const items = (await client.query(
    `SELECT * FROM purchase_invoice_items WHERE "purchaseInvoiceId"=$1 ORDER BY id`,
    [purchaseId],
  )).rows;
  const rate = Number(purchase.exchangeRate || 1);
  const reference = String(purchase.documentNumber);
  const expenseTotals = new Map<string, number>();
  let deductibleVat = 0;
  let reverseVat = 0;
  for (const item of items) {
    const net = round2(Number(item.netAmount) * rate);
    const vat = round2(Number(item.vatAmount) * rate);
    const deductible = round2(vat * Number(item.deductibilityPercent || 0) / 100);
    const expense = round2(net + vat - deductible);
    const account = String(item.expenseAccount || "628");
    expenseTotals.set(account, round2((expenseTotals.get(account) || 0) + expense));
    deductibleVat = round2(deductibleVat + deductible);
    reverseVat = round2(reverseVat + vat);
  }
  const lines: JournalLineInput[] = [];
  for (const [accountCode, amount] of expenseTotals) {
    if (amount) lines.push({ accountCode, debit: amount, explanation: `Achiziție ${reference}`, supplierId: purchase.supplierId });
  }
  if (deductibleVat) lines.push({ accountCode: "4426", debit: deductibleVat, explanation: `TVA deductibilă ${reference}`, supplierId: purchase.supplierId });
  if (purchase.reverseCharge && reverseVat) {
    lines.push({ accountCode: "4427", credit: reverseVat, explanation: `Taxare inversă ${reference}`, supplierId: purchase.supplierId });
  }
  const supplierCredit = round2(Number(purchase.total) * rate);
  lines.push({ accountCode: purchase.analyticAccount, credit: supplierCredit, explanation: `Datorie furnizor ${reference}`, supplierId: purchase.supplierId });
  return replaceAutomaticEntry(client, {
    date: String(purchase.issueDate).slice(0, 10),
    description: `Factură furnizor ${reference} - ${purchase.supplierName}`,
    documentNumber: reference,
    sourceType: "PURCHASE",
    sourceId: purchaseId,
    lines,
  });
}

export async function postSupplierPaymentToLedger(paymentId: number, client: PoolClient) {
  const { rows } = await client.query(
    `SELECT sp.*,p."documentNumber",p."supplierId",p."exchangeRate",s.name AS "supplierName",s."analyticAccount"
       FROM supplier_payments sp JOIN purchase_invoices p ON p.id=sp."purchaseInvoiceId"
       JOIN suppliers s ON s.id=p."supplierId" WHERE sp.id=$1`,
    [paymentId],
  );
  const payment = rows[0];
  if (!payment) throw new Error("Plata furnizorului nu există pentru contare.");
  const cash = ["cash", "numerar"].includes(String(payment.method).toLowerCase());
  const amount = round2(Number(payment.amount) * Number(payment.exchangeRate || 1));
  return replaceAutomaticEntry(client, {
    date: String(payment.date).slice(0, 10),
    description: `Plată furnizor ${payment.supplierName} - ${payment.documentNumber}`,
    documentNumber: payment.reference || payment.documentNumber,
    sourceType: "SUPPLIER_PAYMENT",
    sourceId: paymentId,
    lines: [
      { accountCode: payment.analyticAccount, debit: amount, explanation: `Stingere datorie ${payment.documentNumber}`, supplierId: payment.supplierId },
      { accountCode: cash ? "5311" : "5121", credit: amount, explanation: `Plată ${payment.documentNumber}`, supplierId: payment.supplierId },
    ],
  });
}

export async function removeAutomaticEntriesForInvoice(invoiceId: number, client: PoolClient) {
  const invoice = (await client.query(`SELECT "issueDate" FROM invoices WHERE id=$1`, [invoiceId])).rows[0];
  if (invoice) await assertOpenPeriod(client, String(invoice.issueDate).slice(0, 10));
  const { rows } = await client.query(
    `SELECT id,date FROM payments WHERE "invoiceId"=$1`,
    [invoiceId],
  );
  for (const row of rows) await assertOpenPeriod(client, String(row.date).slice(0, 10));
  await client.query(`DELETE FROM journal_entries WHERE "sourceType"='PAYMENT' AND "sourceId"=ANY($1::int[])`, [rows.map((row) => row.id)]);
  await client.query(`DELETE FROM journal_entries WHERE "sourceType"='INVOICE' AND "sourceId"=$1`, [invoiceId]);
}

export async function backfillAccountingDocuments() {
  const pool = await ready();
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(`SELECT pg_advisory_xact_lock(73002,1)`);
    const invoices = await connection.query(
      `SELECT i.id FROM invoices i LEFT JOIN journal_entries j
         ON j."sourceType"='INVOICE' AND j."sourceId"=i.id
       WHERE j.id IS NULL ORDER BY i.id`,
    );
    for (const row of invoices.rows) await postInvoiceToLedger(Number(row.id), connection);
    const payments = await connection.query(
      `SELECT p.id FROM payments p LEFT JOIN journal_entries j
         ON j."sourceType"='PAYMENT' AND j."sourceId"=p.id
       WHERE j.id IS NULL ORDER BY p.id`,
    );
    for (const row of payments.rows) await postPaymentToLedger(Number(row.id), connection);
    await connection.query("COMMIT");
    return { invoices: invoices.rowCount || 0, payments: payments.rowCount || 0 };
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

export async function listAccounts(search = "") {
  const pool = await ready();
  const term = `%${search.trim()}%`;
  const { rows } = await pool.query(
    `SELECT a.*,
       EXISTS(SELECT 1 FROM journal_lines l WHERE l."accountCode"=a.code) AS used
     FROM accounting_accounts a
     WHERE ($1='%%' OR a.code ILIKE $1 OR a.name ILIKE $1)
     ORDER BY string_to_array(a.code,'.')::text[]`,
    [term],
  );
  return rows;
}

export async function createAnalyticAccount(input: { code: string; name: string; parentCode: string }) {
  const code = input.code.trim();
  const name = input.name.trim();
  const parentCode = input.parentCode.trim();
  if (!/^[0-9]{3,4}(?:\.[0-9A-Za-z-]{1,12})?$/.test(code)) throw new Error("Codul analitic nu este valid.");
  if (!name) throw new Error("Completează denumirea contului.");
  if (!code.startsWith(parentCode) || code === parentCode) throw new Error("Codul analitic trebuie să extindă contul părinte.");
  const pool = await ready();
  const parent = (await pool.query(`SELECT * FROM accounting_accounts WHERE code=$1`, [parentCode])).rows[0];
  if (!parent) throw new Error("Contul părinte nu există.");
  await pool.query(
    `INSERT INTO accounting_accounts (code,name,nature,"allowPosting",active,system)
     VALUES ($1,$2,$3,1,1,0)`,
    [code, name, parent.nature === "GROUP" ? "BOTH" : parent.nature],
  );
}

export async function setAccountActive(code: string, active: boolean) {
  const pool = await ready();
  const result = await pool.query(`UPDATE accounting_accounts SET active=$2,"updatedAt"=now() WHERE code=$1`, [code, active ? 1 : 0]);
  if (!result.rowCount) throw new Error("Contul nu există.");
}

export async function listJournal(range: { from?: string; to?: string } = {}) {
  const pool = await ready();
  const from = range.from || "1900-01-01";
  const to = range.to || "2999-12-31";
  const { rows } = await pool.query(
    `SELECT e.*,COALESCE(SUM(l.debit),0) AS debit,COALESCE(SUM(l.credit),0) AS credit,
       json_agg(json_build_object('id',l.id,'accountCode',l."accountCode",'accountName',a.name,
         'debit',l.debit,'credit',l.credit,'explanation',l.explanation) ORDER BY l."lineNumber") AS lines
     FROM journal_entries e JOIN journal_lines l ON l."entryId"=e.id
     JOIN accounting_accounts a ON a.code=l."accountCode"
     WHERE e.date BETWEEN $1 AND $2
     GROUP BY e.id ORDER BY e.date DESC,e."entryNumber" DESC`,
    [from, to],
  );
  return rows;
}

export async function getTrialBalance(range: { from: string; to: string }) {
  const pool = await ready();
  const { rows } = await pool.query(
    `WITH totals AS (
       SELECT l."accountCode",
         SUM(CASE WHEN e.date<$1 THEN l.debit ELSE 0 END) AS "initialDebitMovement",
         SUM(CASE WHEN e.date<$1 THEN l.credit ELSE 0 END) AS "initialCreditMovement",
         SUM(CASE WHEN e.date BETWEEN $1 AND $2 THEN l.debit ELSE 0 END) AS debit,
         SUM(CASE WHEN e.date BETWEEN $1 AND $2 THEN l.credit ELSE 0 END) AS credit,
         SUM(CASE WHEN e.date<=$2 THEN l.debit ELSE 0 END) AS "totalDebit",
         SUM(CASE WHEN e.date<=$2 THEN l.credit ELSE 0 END) AS "totalCredit"
       FROM journal_lines l JOIN journal_entries e ON e.id=l."entryId"
       GROUP BY l."accountCode"
     )
     SELECT a.code,a.name,a.nature,
       GREATEST(COALESCE(t."initialDebitMovement",0)-COALESCE(t."initialCreditMovement",0),0) AS "initialDebit",
       GREATEST(COALESCE(t."initialCreditMovement",0)-COALESCE(t."initialDebitMovement",0),0) AS "initialCredit",
       COALESCE(t.debit,0) AS debit,COALESCE(t.credit,0) AS credit,
       COALESCE(t."totalDebit",0) AS "totalDebit",COALESCE(t."totalCredit",0) AS "totalCredit",
       GREATEST(COALESCE(t."totalDebit",0)-COALESCE(t."totalCredit",0),0) AS "finalDebit",
       GREATEST(COALESCE(t."totalCredit",0)-COALESCE(t."totalDebit",0),0) AS "finalCredit"
     FROM accounting_accounts a JOIN totals t ON t."accountCode"=a.code
     ORDER BY string_to_array(a.code,'.')::text[]`,
    [range.from, range.to],
  );
  return rows;
}

export async function getAccountLedger(code: string, range: { from: string; to: string }) {
  const pool = await ready();
  const account = (await pool.query(`SELECT * FROM accounting_accounts WHERE code=$1`, [code])).rows[0];
  if (!account) throw new Error("Contul nu există.");
  const opening = Number((await pool.query(
    `SELECT COALESCE(SUM(l.debit-l.credit),0) AS balance FROM journal_lines l JOIN journal_entries e ON e.id=l."entryId" WHERE l."accountCode"=$1 AND e.date<$2`,
    [code, range.from],
  )).rows[0].balance);
  const { rows } = await pool.query(
    `SELECT e.date,e."entryNumber",e.description,e."documentNumber",e."sourceType",l.debit,l.credit,l.explanation,
       $4::numeric + SUM(l.debit-l.credit) OVER (ORDER BY e.date,e."entryNumber",l."lineNumber") AS balance
     FROM journal_lines l JOIN journal_entries e ON e.id=l."entryId"
     WHERE l."accountCode"=$1 AND e.date BETWEEN $2 AND $3
     ORDER BY e.date,e."entryNumber",l."lineNumber"`,
    [code, range.from, range.to, opening],
  );
  return { account, opening, rows };
}

export async function listPeriods(year: number) {
  const pool = await ready();
  const { rows } = await pool.query(
    `SELECT months.month,COALESCE(p.status,'OPEN') AS status,p."closedAt",p."closedBy",p.notes
     FROM generate_series(1,12) AS months(month)
     LEFT JOIN accounting_periods p ON p.year=$1 AND p.month=months.month ORDER BY months.month`,
    [year],
  );
  return rows;
}

export async function setPeriodStatus(year: number, month: number, status: "OPEN" | "CLOSED", closedBy = "") {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Perioada nu este validă.");
  }
  const pool = await ready();
  await pool.query(
    `INSERT INTO accounting_periods (year,month,status,"closedAt","closedBy")
     VALUES ($1,$2,$3,CASE WHEN $3='CLOSED' THEN now() ELSE NULL END,$4)
     ON CONFLICT (year,month) DO UPDATE SET status=EXCLUDED.status,"closedAt"=EXCLUDED."closedAt","closedBy"=EXCLUDED."closedBy"`,
    [year, month, status, status === "CLOSED" ? closedBy : ""],
  );
}

export async function getLedgerStats() {
  const pool = await ready();
  const month = new Date().toISOString().slice(0, 7);
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM accounting_accounts WHERE active=1 AND "allowPosting"=1) AS accounts,
       (SELECT COUNT(*) FROM journal_entries) AS entries,
       (SELECT COALESCE(SUM(l.debit),0) FROM journal_lines l JOIN journal_entries e ON e.id=l."entryId" WHERE to_char(e.date,'YYYY-MM')=$1) AS "monthDebit",
       (SELECT COUNT(*) FROM accounting_periods WHERE status='CLOSED') AS "closedPeriods"`,
    [month],
  );
  return rows[0];
}
