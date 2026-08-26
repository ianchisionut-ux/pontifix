import type { PoolClient } from "pg";
import { ready } from "@/lib/accounting/db";

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
  netAmount: number;
  fiscalCategory: RefFiscalCategory;
  deductibilityPercent: number;
  fiscalAmount: number;
  invoiceId: number | null;
  paymentId: number | null;
  source: "MANUAL" | "AUTO_PAYMENT";
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
  fiscalCategory: RefFiscalCategory;
  deductibilityPercent?: number;
  notes?: string;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function mapTransaction(row: Record<string, unknown>): RefTransaction {
  return {
    ...(row as unknown as RefTransaction),
    date: String(row.date).slice(0, 10),
    grossAmount: Number(row.grossAmount),
    vatAmount: Number(row.vatAmount),
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
       "fiscalCategory", "deductibilityPercent", "fiscalAmount", source, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'MANUAL',$12) RETURNING id`,
    [input.type, input.date, input.documentType.trim(), input.documentNumber?.trim() || "", input.explanation.trim(),
      gross, vat, net, input.fiscalCategory, percent, fiscalAmount, input.notes?.trim() || ""]
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
  const companyResult = await executor.query(`SELECT "vatPayer" FROM company WHERE id=1`);
  const vatPayer = Boolean(Number(companyResult.rows[0]?.vatPayer || 0));
  const gross = round2(input.amount);
  const net = vatPayer && input.invoiceTotal > 0
    ? round2(gross * input.invoiceSubtotal / input.invoiceTotal)
    : gross;
  const vat = round2(gross - net);
  const fiscalAmount = vatPayer ? net : gross;
  await executor.query(
    `INSERT INTO ref_transactions
      (type, date, "documentType", "documentNumber", explanation, "grossAmount", "vatAmount", "netAmount",
       "fiscalCategory", "deductibilityPercent", "fiscalAmount", "invoiceId", "paymentId", source)
     VALUES ('INCOME',$1,'FACTURA',$2,$3,$4,$5,$6,'TAXABLE_INCOME',100,$7,$8,$9,'AUTO_PAYMENT')
     ON CONFLICT ("paymentId") WHERE "paymentId" IS NOT NULL DO NOTHING`,
    [input.date, `${input.series} ${input.number}`, `Încasare factură – ${input.clientName}`, gross, vat, net,
      fiscalAmount, input.invoiceId, input.paymentId]
  );
}

export async function listRefTransactions(year: number): Promise<RefTransaction[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    `SELECT * FROM ref_transactions WHERE EXTRACT(YEAR FROM date)=$1 ORDER BY date, id`,
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

export async function getRefReport(year: number) {
  const transactions = await listRefTransactions(year);
  return { transactions, summary: summarizeRefTransactions(transactions), vatPayer: await getRefVatPayer() };
}

export async function deleteRefTransaction(id: number) {
  const pool = await ready();
  const { rowCount } = await pool.query(`DELETE FROM ref_transactions WHERE id=$1 AND source='MANUAL'`, [id]);
  if (!rowCount) throw new Error("Înregistrările generate automat din încasări nu pot fi șterse manual.");
}