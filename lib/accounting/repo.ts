import { ready } from "./db";
import { createRefIncomeForPayment } from "./ref";

export type User = {
  id: number;
  name: string;
  ci: string;
  cnp: string;
  role: string;
  active: number;
  createdAt: string;
};

export type Company = {
  id: number;
  name: string;
  regCom: string;
  cif: string;
  address: string;
  iban: string;
  iban2: string;
  iban3: string;
  bank: string;
  phone: string;
  email: string;
  vatIncasare: number;
  vatPayer: number;
  countryCode: string;
  county: string;
  city: string;
  postalCode: string;
};

export type Client = {
  id: number;
  name: string;
  clientType: "PF" | "PJ";
  regCom: string;
  cif: string;
  cnp: string;
  address: string;
  judet: string;
  city: string;
  phone: string;
  email: string;
  vatPayer: number;
  countryCode: string;
  postalCode: string;
  ciSeries: string;
  ciNumber: string;
  sourceConnectionId: string | null;
  sourceNib: string;
  flagged: number;
  createdAt: string;
};

export type ClientInput = Omit<Client, "id" | "createdAt" | "flagged" | "sourceConnectionId" | "sourceNib"> & {
  sourceConnectionId?: string | null;
  sourceNib?: string;
};

export type Product = {
  id: number;
  name: string;
  um: string;
  price: number;
  cost: number;
  vatRate: number;
  unitCode: string;
  vatCategoryCode: string;
  taxExemptionReasonCode: string;
  taxExemptionReason: string;
};

export type InvoiceItemInput = {
  productId?: number | null;
  description: string;
  um: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
  unitCode?: string;
  vatCategoryCode?: string;
  taxExemptionReasonCode?: string;
  taxExemptionReason?: string;
};

export type InvoiceItem = InvoiceItemInput & {
  id: number;
  invoiceId: number;
  productId: number | null;
  valoare: number;
  vatValue: number;
};

export type Invoice = {
  id: number;
  series: string;
  number: number;
  clientId: number;
  userId: number | null;
  issueDate: string;
  dueDate: string | null;
  status: "issued" | "paid" | "partial" | "canceled" | "storno" | "stornoed";
  invoiceType: "STANDARD" | "STORNO";
  originalInvoiceId: number | null;
  stornoReason: string;
  invoiceTypeCode: string;
  paymentMeansCode: string;
  paymentTerms: string;
  taxPointDate: string;
  buyerReference: string;
  sellerSnapshot: Company | Record<string, never>;
  clientSnapshot: Client | Record<string, never>;
  paidAmount: number;
  subtotal: number;
  vatTotal: number;
  total: number;
  discountPercent: number;
  currency: string;
  exchangeRate: number;
  notes: string;
  delegateName: string;
  delegateCI: string;
  delegateCNP: string;
  vehiclePlate: string;
  deliveryDate: string;
  deliveryTime: string;
  createdAt: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------- Company ----------
export async function getCompany(): Promise<Company> {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT * FROM company WHERE id = 1`);
  return rows[0] as Company;
}

export async function updateCompany(data: Omit<Company, "id">) {
  const pool = await ready();
  await pool.query(
    `UPDATE company SET name=$1, "regCom"=$2, cif=$3, address=$4, iban=$5, "iban2"=$6, "iban3"=$7, bank=$8, phone=$9, email=$10, "vatIncasare"=$11,
     "vatPayer"=$12, "countryCode"=$13, county=$14, city=$15, "postalCode"=$16 WHERE id=1`,
    [data.name, data.regCom, data.cif, data.address, data.iban, data.iban2, data.iban3, data.bank, data.phone, data.email, data.vatIncasare,
      data.vatPayer ? 1 : 0, data.countryCode || "RO", data.county ?? "", data.city ?? "", data.postalCode ?? ""]
  );
}

// ---------- Users ----------
export async function listUsers(includeInactive = false): Promise<User[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    includeInactive
      ? `SELECT * FROM users ORDER BY active DESC, name`
      : `SELECT * FROM users WHERE active=1 ORDER BY name`
  );
  return rows as User[];
}

export async function getUser(id: number): Promise<User | undefined> {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT * FROM users WHERE id=$1`, [id]);
  return rows[0] as User | undefined;
}

export async function createUser(data: { name: string; ci: string; cnp: string; role: string }): Promise<number> {
  const pool = await ready();
  const { rows } = await pool.query(
    `INSERT INTO users (name, ci, cnp, role, active) VALUES ($1,$2,$3,$4,1) RETURNING id`,
    [data.name, data.ci, data.cnp, data.role]
  );
  return rows[0].id as number;
}

export async function updateUser(
  id: number,
  data: { name: string; ci: string; cnp: string; role: string; active: number }
) {
  const pool = await ready();
  await pool.query(`UPDATE users SET name=$1, ci=$2, cnp=$3, role=$4, active=$5 WHERE id=$6`, [
    data.name,
    data.ci,
    data.cnp,
    data.role,
    data.active,
    id,
  ]);
}

export async function deleteUser(id: number) {
  const pool = await ready();
  await pool.query(`DELETE FROM users WHERE id=$1`, [id]);
}

// ---------- Clients ----------
export async function listClients(): Promise<Client[]> {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT * FROM clients ORDER BY name`);
  return rows as Client[];
}

export async function getClient(id: number): Promise<Client | undefined> {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT * FROM clients WHERE id=$1`, [id]);
  return rows[0] as Client | undefined;
}

export async function createClient(data: ClientInput): Promise<number> {
  const pool = await ready();
  const { rows } = await pool.query(
    `INSERT INTO clients (name, "clientType", "regCom", cif, cnp, address, judet, city, phone, email, "ciSeries", "ciNumber", "vatPayer", "countryCode", "postalCode", "sourceConnectionId", "sourceNib")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
    [data.name, data.clientType || "PJ", data.regCom ?? "", data.cif ?? "", data.cnp ?? "", data.address ?? "", data.judet ?? "", data.city ?? "", data.phone ?? "", data.email ?? "", data.ciSeries ?? "", data.ciNumber ?? "",
      data.vatPayer ? 1 : 0, data.countryCode || "RO", data.postalCode ?? "", data.sourceConnectionId ?? null, data.sourceNib ?? ""]
  );
  return rows[0].id as number;
}

export async function updateClient(id: number, data: ClientInput) {
  const pool = await ready();
  await pool.query(
    `UPDATE clients SET name=$1, "clientType"=$2, "regCom"=$3, cif=$4, cnp=$5, address=$6, judet=$7, city=$8, phone=$9, email=$10, "ciSeries"=$11, "ciNumber"=$12,
     "vatPayer"=$13, "countryCode"=$14, "postalCode"=$15 WHERE id=$16`,
    [data.name, data.clientType || "PJ", data.regCom ?? "", data.cif ?? "", data.cnp ?? "", data.address ?? "", data.judet ?? "", data.city ?? "", data.phone ?? "", data.email ?? "", data.ciSeries ?? "", data.ciNumber ?? "",
      data.vatPayer ? 1 : 0, data.countryCode || "RO", data.postalCode ?? "", id]
  );
}

export async function syncClientFromConnection(data: {
  connectionId: string; nib: string; name: string; identifier: string; address: string;
  judet: string; city: string; phone: string; ciSeries: string; ciNumber: string;
}): Promise<number> {
  const pool = await ready();
  const digits = data.identifier.replace(/\D/g, "");
  const clientType: "PF" | "PJ" = digits.length === 13 ? "PF" : "PJ";
  const cnp = clientType === "PF" ? digits : "";
  const cif = clientType === "PJ" ? data.identifier.trim() : "";
  const existing = await pool.query(
    `SELECT id FROM clients WHERE "sourceConnectionId"=$1 OR ($2<>'' AND cnp=$2) OR ($3<>'' AND cif=$3) ORDER BY ("sourceConnectionId"=$1) DESC LIMIT 1`,
    [data.connectionId, cnp, cif]
  );
  if (existing.rows[0]) {
    const id = Number(existing.rows[0].id);
    await pool.query(
      `UPDATE clients SET name=COALESCE(NULLIF($1,''),name), "clientType"=$2,
       cif=CASE WHEN $2='PJ' THEN COALESCE(NULLIF($3,''),cif) ELSE cif END,
       cnp=CASE WHEN $2='PF' THEN COALESCE(NULLIF($4,''),cnp) ELSE cnp END,
       address=COALESCE(NULLIF($5,''),address), judet=COALESCE(NULLIF($6,''),judet),
       city=COALESCE(NULLIF($7,''),city), phone=COALESCE(NULLIF($8,''),phone),
       "ciSeries"=COALESCE(NULLIF($9,''),"ciSeries"), "ciNumber"=COALESCE(NULLIF($10,''),"ciNumber"),
       "sourceConnectionId"=$11, "sourceNib"=$12 WHERE id=$13`,
      [data.name, clientType, cif, cnp, data.address, data.judet, data.city, data.phone, data.ciSeries, data.ciNumber, data.connectionId, data.nib, id]
    );
    return id;
  }
  return createClient({
    name: data.name || `Beneficiar ${data.nib}`, clientType, regCom: "", cif, cnp,
    address: data.address, judet: data.judet, city: data.city, phone: data.phone,
    email: "", ciSeries: data.ciSeries, ciNumber: data.ciNumber,
    vatPayer: 0, countryCode: "RO", postalCode: "",
    sourceConnectionId: data.connectionId, sourceNib: data.nib,
  });
}

export async function syncClientFromOffer(data: {
  offerId: string; name: string; identifier: string; address: string;
  phone: string; email: string;
}): Promise<number> {
  const pool = await ready();
  const digits = data.identifier.replace(/\D/g, "");
  const companyName = /\b(SRL|S\.R\.L\.?|SA|S\.A\.?|PFA|II|IF)\b/i.test(data.name);
  const clientType: "PF" | "PJ" = digits.length === 13 ? "PF" : (digits.length > 0 || companyName ? "PJ" : "PF");
  const cnp = clientType === "PF" ? digits : "";
  const cif = clientType === "PJ" ? data.identifier.trim() : "";
  const phone = data.phone.trim();
  const email = data.email.trim().toLowerCase();
  const existing = await pool.query(
    `SELECT id FROM clients
     WHERE ($1<>'' AND cnp=$1) OR ($2<>'' AND cif=$2)
        OR ($3<>'' AND lower(email)=$3) OR ($4<>'' AND phone=$4)
        OR lower(name)=lower($5)
     ORDER BY (($1<>'' AND cnp=$1) OR ($2<>'' AND cif=$2)) DESC, id ASC LIMIT 1`,
    [cnp, cif, email, phone, data.name.trim()]
  );
  if (existing.rows[0]) {
    const id = Number(existing.rows[0].id);
    await pool.query(
      `UPDATE clients SET name=COALESCE(NULLIF($1,''),name), "clientType"=$2,
       cif=CASE WHEN $2='PJ' THEN COALESCE(NULLIF($3,''),cif) ELSE cif END,
       cnp=CASE WHEN $2='PF' THEN COALESCE(NULLIF($4,''),cnp) ELSE cnp END,
       address=COALESCE(NULLIF($5,''),address), phone=COALESCE(NULLIF($6,''),phone),
       email=COALESCE(NULLIF($7,''),email) WHERE id=$8`,
      [data.name, clientType, cif, cnp, data.address, phone, email, id]
    );
    return id;
  }
  return createClient({
    name: data.name || `Beneficiar ofertă ${data.offerId.slice(0, 6)}`, clientType,
    regCom: "", cif, cnp, address: data.address, judet: "", city: "",
    phone, email, ciSeries: "", ciNumber: "",
    vatPayer: 0, countryCode: "RO", postalCode: "",
  });
}

export async function setClientFlagged(id: number, flagged: boolean) {
  const pool = await ready();
  await pool.query(`UPDATE clients SET flagged=$1 WHERE id=$2`, [flagged ? 1 : 0, id]);
}

export async function deleteClient(id: number) {
  const pool = await ready();
  await pool.query(`DELETE FROM clients WHERE id=$1`, [id]);
}

// ---------- Products ----------
export async function listProducts(): Promise<Product[]> {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT * FROM products ORDER BY name`);
  return rows as Product[];
}

export async function createProduct(data: Omit<Product, "id">): Promise<number> {
  const pool = await ready();
  const { rows } = await pool.query(
    `INSERT INTO products (name, um, price, cost, "vatRate", "unitCode", "vatCategoryCode", "taxExemptionReasonCode", "taxExemptionReason") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [data.name, data.um, data.price, data.cost, data.vatRate, data.unitCode || "H87", data.vatCategoryCode || "S", data.taxExemptionReasonCode || "", data.taxExemptionReason || ""]
  );
  return rows[0].id as number;
}

export async function updateProduct(id: number, data: Omit<Product, "id">) {
  const pool = await ready();
  await pool.query(`UPDATE products SET name=$1, um=$2, price=$3, cost=$4, "vatRate"=$5, "unitCode"=$6, "vatCategoryCode"=$7, "taxExemptionReasonCode"=$8, "taxExemptionReason"=$9 WHERE id=$10`, [
    data.name,
    data.um,
    data.price,
    data.cost,
    data.vatRate,
    data.unitCode || "H87",
    data.vatCategoryCode || "S",
    data.taxExemptionReasonCode || "",
    data.taxExemptionReason || "",
    id,
  ]);
}

export async function deleteProduct(id: number) {
  const pool = await ready();
  await pool.query(`DELETE FROM products WHERE id=$1`, [id]);
}

// ---------- Counters / numbering ----------
export async function peekNextNumber(series: string): Promise<number> {
  const pool = await ready();
  const normalized = series.trim().toUpperCase() || "ELM";
  const { rows } = await pool.query(`SELECT "lastNumber" FROM counters WHERE series=$1`, [normalized]);
  return (rows[0]?.lastNumber ?? 0) + 1;
}

async function takeNextNumber(series: string): Promise<number> {
  const pool = await ready();
  // Atomic upsert-and-increment so two concurrent requests never collide.
  const { rows } = await pool.query(
    `INSERT INTO counters (series, "lastNumber") VALUES ($1, 1)
     ON CONFLICT (series) DO UPDATE SET "lastNumber" = counters."lastNumber" + 1
     RETURNING "lastNumber"`,
    [series]
  );
  return rows[0].lastNumber as number;
}

async function takeInvoiceNumber(series: string, requested?: number): Promise<number> {
  if (requested === undefined) return takeNextNumber(series);
  if (!Number.isInteger(requested) || requested <= 0) {
    throw new Error("Numărul facturii trebuie să fie un număr întreg pozitiv.");
  }
  const pool = await ready();
  const duplicate = await pool.query(`SELECT id FROM invoices WHERE series=$1 AND number=$2 LIMIT 1`, [series, requested]);
  if (duplicate.rows[0]) throw new Error(`Factura ${series} ${requested} există deja.`);
  await pool.query(
    `INSERT INTO counters (series, "lastNumber") VALUES ($1,$2)
     ON CONFLICT (series) DO UPDATE SET "lastNumber"=GREATEST(counters."lastNumber", EXCLUDED."lastNumber")`,
    [series, requested]
  );
  return requested;
}

// ---------- Invoices ----------
function computeTotals(items: InvoiceItemInput[], discountPercent = 0) {
  let subtotal = 0;
  let vatTotal = 0;
  const factor = 1 - (discountPercent || 0) / 100;
  const computed = items.map((it) => {
    const valoare = round2(it.qty * it.unitPrice * factor);
    const vatValue = round2((valoare * it.vatRate) / 100);
    subtotal += valoare;
    vatTotal += vatValue;
    return { ...it, valoare, vatValue };
  });
  return { computed, subtotal: round2(subtotal), vatTotal: round2(vatTotal) };
}

export async function createInvoice(input: {
  series: string;
  number?: number;
  clientId: number;
  userId?: number | null;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  delegateName?: string;
  delegateCI?: string;
  delegateCNP?: string;
  vehiclePlate?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  discountPercent?: number;
  currency?: string;
  exchangeRate?: number;
  items: InvoiceItemInput[];
  invoiceType?: "STANDARD" | "STORNO";
  originalInvoiceId?: number | null;
  stornoReason?: string;
  initialStatus?: Invoice["status"];
  invoiceTypeCode?: string;
  paymentMeansCode?: string;
  paymentTerms?: string;
  taxPointDate?: string;
  buyerReference?: string;
  sellerSnapshot?: Company;
  clientSnapshot?: Client;
}): Promise<number> {
  const pool = await ready();
  const series = input.series.trim().toUpperCase();
  if (!series) throw new Error("Completează seria facturii.");
  const number = await takeInvoiceNumber(series, input.number);
  const discountPercent = input.discountPercent ?? 0;
  const { computed, subtotal, vatTotal } = computeTotals(input.items, discountPercent);
  const total = round2(subtotal + vatTotal);
  const clientResult = await pool.query(`SELECT * FROM clients WHERE id=$1`, [input.clientId]);
  const companyResult = await pool.query(`SELECT * FROM company WHERE id=1`);
  if (!clientResult.rows[0]) throw new Error("Clientul selectat nu există.");

  const { rows } = await pool.query(
    `INSERT INTO invoices
      (series, number, "clientId", "userId", "issueDate", "dueDate", status, "paidAmount", subtotal, "vatTotal", total, "discountPercent", currency, "exchangeRate", notes, "delegateName", "delegateCI", "delegateCNP", "vehiclePlate", "deliveryDate", "deliveryTime")
     VALUES ($1,$2,$3,$4,$5,$6,'issued',0,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING id`,
    [
      series,
      number,
      input.clientId,
      input.userId ?? null,
      input.issueDate,
      input.dueDate ?? null,
      subtotal,
      vatTotal,
      total,
      discountPercent,
      input.currency ?? "RON",
      input.exchangeRate ?? 1,
      input.notes ?? "",
      input.delegateName ?? "",
      input.delegateCI ?? "",
      input.delegateCNP ?? "",
      input.vehiclePlate ?? "",
      input.deliveryDate ?? "",
      input.deliveryTime ?? "",
    ]
  );

  const invoiceId = rows[0].id as number;
  await pool.query(
    `UPDATE invoices SET "invoiceType"=$1, "originalInvoiceId"=$2, "stornoReason"=$3, status=$4,
     "invoiceTypeCode"=$5, "paymentMeansCode"=$6, "paymentTerms"=$7, "taxPointDate"=$8, "buyerReference"=$9,
     "sellerSnapshot"=$10::jsonb, "clientSnapshot"=$11::jsonb WHERE id=$12`,
    [input.invoiceType ?? "STANDARD", input.originalInvoiceId ?? null, input.stornoReason ?? "", input.initialStatus ?? "issued",
      input.invoiceTypeCode || (input.invoiceType === "STORNO" ? "381" : "380"), input.paymentMeansCode || "30", input.paymentTerms ?? "",
      input.taxPointDate || input.issueDate, input.buyerReference ?? "", JSON.stringify(input.sellerSnapshot || companyResult.rows[0] || {}), JSON.stringify(input.clientSnapshot || clientResult.rows[0]), invoiceId]
  );
  for (const it of computed) {
    await pool.query(
      `INSERT INTO invoice_items ("invoiceId", "productId", description, um, qty, "unitPrice", "vatRate", valoare, "vatValue", "unitCode", "vatCategoryCode", "taxExemptionReasonCode", "taxExemptionReason")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [invoiceId, it.productId ?? null, it.description, it.um, it.qty, it.unitPrice, it.vatRate, it.valoare, it.vatValue,
        it.unitCode || "H87", it.vatCategoryCode || (it.vatRate === 0 ? "Z" : "S"), it.taxExemptionReasonCode || "", it.taxExemptionReason || ""]
    );
  }
  return invoiceId;
}

export async function createStornoInvoice(input: {
  originalInvoiceId: number;
  series?: string;
  issueDate: string;
  reason: string;
}): Promise<number> {
  const original = await getInvoiceFull(input.originalInvoiceId);
  if (!original?.client) throw new Error("Factura selectată nu există.");
  if (original.invoice.invoiceType === "STORNO" || ["storno", "stornoed", "canceled"].includes(original.invoice.status)) {
    throw new Error("Factura selectată nu poate fi stornată.");
  }
  const pool = await ready();
  const duplicate = await pool.query(`SELECT id FROM invoices WHERE "originalInvoiceId"=$1 AND "invoiceType"='STORNO' LIMIT 1`, [input.originalInvoiceId]);
  if (duplicate.rows[0]) throw new Error("Factura selectată are deja o factură storno.");

  const reference = `${original.invoice.series} ${String(original.invoice.number).padStart(4, "0")}`;
  const id = await createInvoice({
    series: (input.series || "STO").toUpperCase(),
    clientId: original.invoice.clientId,
    userId: original.invoice.userId,
    issueDate: input.issueDate,
    dueDate: input.issueDate,
    currency: original.invoice.currency,
    exchangeRate: original.invoice.exchangeRate,
    notes: `Storno pentru factura ${reference}. Motiv: ${input.reason}`,
    delegateName: original.invoice.delegateName,
    delegateCI: original.invoice.delegateCI,
    delegateCNP: original.invoice.delegateCNP,
    discountPercent: original.invoice.discountPercent,
    invoiceType: "STORNO",
    originalInvoiceId: original.invoice.id,
    stornoReason: input.reason,
    invoiceTypeCode: "381",
    paymentMeansCode: original.invoice.paymentMeansCode,
    paymentTerms: original.invoice.paymentTerms,
    taxPointDate: input.issueDate,
    buyerReference: original.invoice.buyerReference,
    sellerSnapshot: original.company,
    clientSnapshot: original.client,
    initialStatus: "storno",
    items: original.items.map((item) => ({
      productId: item.productId,
      description: `STORNO - ${item.description}`,
      um: item.um,
      qty: Math.abs(item.qty),
      unitPrice: -Math.abs(item.unitPrice),
      vatRate: item.vatRate,
      unitCode: item.unitCode,
      vatCategoryCode: item.vatCategoryCode,
      taxExemptionReasonCode: item.taxExemptionReasonCode,
      taxExemptionReason: item.taxExemptionReason,
    })),
  });
  await pool.query(`UPDATE invoices SET status='stornoed' WHERE id=$1`, [original.invoice.id]);
  return id;
}
export async function listInvoices(): Promise<(Invoice & { clientName: string; userName: string | null })[]> {
  const pool = await ready();
  const { rows } = await pool.query(
    `SELECT i.*, c.name as "clientName", u.name as "userName" FROM invoices i
     JOIN clients c ON c.id = i."clientId"
     LEFT JOIN users u ON u.id = i."userId"
     ORDER BY i."issueDate" DESC, i.id DESC`
  );
  return rows as (Invoice & { clientName: string; userName: string | null })[];
}

export async function getInvoice(id: number): Promise<Invoice | undefined> {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT * FROM invoices WHERE id=$1`, [id]);
  return rows[0] as Invoice | undefined;
}

export async function getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]> {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT * FROM invoice_items WHERE "invoiceId"=$1`, [invoiceId]);
  return rows as InvoiceItem[];
}

export async function getInvoiceFull(id: number) {
  const invoice = await getInvoice(id);
  if (!invoice) return undefined;
  const [items, liveClient, liveCompany, receipts, payments, user] = await Promise.all([
    getInvoiceItems(id),
    getClient(invoice.clientId),
    getCompany(),
    listReceiptsForInvoice(id),
    listPaymentsForInvoice(id),
    invoice.userId ? getUser(invoice.userId) : Promise.resolve(undefined),
  ]);
  const client = Object.keys(invoice.clientSnapshot || {}).length ? invoice.clientSnapshot as Client : liveClient;
  const company = Object.keys(invoice.sellerSnapshot || {}).length ? invoice.sellerSnapshot as Company : liveCompany;
  return { invoice, items, client, company, receipts, payments, user };
}

export async function setInvoiceStatus(id: number, status: Invoice["status"]) {
  const pool = await ready();
  await pool.query(`UPDATE invoices SET status=$1 WHERE id=$2`, [status, id]);
}

export async function deleteInvoice(id: number) {
  const pool = await ready();
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const { rows } = await connection.query(
      `SELECT id, status, "invoiceType", "originalInvoiceId", total, "paidAmount" FROM invoices WHERE id=$1 FOR UPDATE`,
      [id]
    );
    const invoice = rows[0] as Invoice | undefined;
    if (!invoice) throw new Error("Factura nu există.");

    if (invoice.invoiceType === "STORNO") {
      await connection.query(`DELETE FROM receipts WHERE "invoiceId"=$1`, [id]);
      await connection.query(`DELETE FROM invoices WHERE id=$1`, [id]);
      if (invoice.originalInvoiceId) {
        const original = (await connection.query(`SELECT total, "paidAmount" FROM invoices WHERE id=$1`, [invoice.originalInvoiceId])).rows[0];
        if (original) {
          const paid = Number(original.paidAmount || 0);
          const total = Number(original.total || 0);
          const status: Invoice["status"] = paid <= 0 ? "issued" : paid >= total ? "paid" : "partial";
          await connection.query(`UPDATE invoices SET status=$1 WHERE id=$2`, [status, invoice.originalInvoiceId]);
        }
      }
    } else {
      await connection.query(
        `DELETE FROM receipts WHERE "invoiceId"=$1 OR "invoiceId" IN (SELECT id FROM invoices WHERE "originalInvoiceId"=$1)`,
        [id]
      );
      await connection.query(`DELETE FROM invoices WHERE "originalInvoiceId"=$1`, [id]);
      await connection.query(`DELETE FROM invoices WHERE id=$1`, [id]);
    }
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

// ---------- Payments ----------
export async function addPayment(invoiceId: number, amount: number, date: string, method: string, notes?: string) {
  const pool = await ready();
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const { rows: invoiceRows } = await connection.query(`SELECT * FROM invoices WHERE id=$1 FOR UPDATE`, [invoiceId]);
    const invoice = invoiceRows[0] as Invoice | undefined;
    if (!invoice || invoice.invoiceType === "STORNO" || ["storno", "stornoed", "canceled"].includes(invoice.status)) {
      throw new Error("Factura selectată nu acceptă încasări.");
    }
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Suma încasată trebuie să fie pozitivă.");

    const { rows: paymentRows } = await connection.query(
      `INSERT INTO payments ("invoiceId", amount, date, method, notes) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [invoiceId, amount, date, method, notes ?? ""]
    );
    const { rows: clientRows } = await connection.query(`SELECT * FROM clients WHERE id=$1`, [invoice.clientId]);
    const snapshotClient = Object.keys(invoice.clientSnapshot || {}).length ? invoice.clientSnapshot as Client : undefined;
    const client = snapshotClient || clientRows[0] as Client | undefined;
    await createRefIncomeForPayment({
      paymentId: Number(paymentRows[0].id), invoiceId, date, amount,
      invoiceTotal: Number(invoice.total), invoiceSubtotal: Number(invoice.subtotal),
      series: invoice.series, number: invoice.number, clientName: client?.name || "Client",
    }, connection);

    const { rows: sumRows } = await connection.query(
      `SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE "invoiceId"=$1`, [invoiceId]
    );
    const paid = round2(Number(sumRows[0].s));
    const status: Invoice["status"] = paid <= 0 ? "issued" : paid >= invoice.total ? "paid" : "partial";
    await connection.query(`UPDATE invoices SET "paidAmount"=$1, status=$2 WHERE id=$3`, [paid, status, invoiceId]);
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}
export async function listPaymentsForInvoice(invoiceId: number) {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT * FROM payments WHERE "invoiceId"=$1 ORDER BY date`, [invoiceId]);
  return rows as { id: number; invoiceId: number; amount: number; date: string; method: string; notes: string }[];
}

// ---------- Receipts ----------
export async function createReceipt(
  invoiceId: number,
  issueDate: string,
  amount: number,
  cashier?: string
): Promise<number> {
  const pool = await ready();
  const invoice = await getInvoice(invoiceId);
  if (!invoice || invoice.invoiceType === "STORNO" || ["storno", "stornoed", "canceled"].includes(invoice.status)) {
    throw new Error("Pentru această factură nu se poate emite chitanță.");
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valoarea chitanței trebuie să fie pozitivă.");
  const number = await takeNextNumber("CH1");
  const { rows } = await pool.query(
    `INSERT INTO receipts (series, number, "invoiceId", "issueDate", amount, cashier) VALUES ('CH1',$1,$2,$3,$4,$5) RETURNING id`,
    [number, invoiceId, issueDate, amount, cashier ?? ""]
  );
  return rows[0].id as number;
}

export async function listReceiptsForInvoice(invoiceId: number) {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT * FROM receipts WHERE "invoiceId"=$1 ORDER BY id`, [invoiceId]);
  return rows as {
    id: number;
    series: string;
    number: number;
    invoiceId: number;
    issueDate: string;
    amount: number;
    cashier: string;
  }[];
}

export async function getReceipt(id: number) {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT * FROM receipts WHERE id=$1`, [id]);
  return rows[0] as
    | { id: number; series: string; number: number; invoiceId: number; issueDate: string; amount: number; cashier: string }
    | undefined;
}

// ---------- Dashboard stats ----------
export async function getDashboardStats() {
  const pool = await ready();
  const totalInvoices = Number((await pool.query(`SELECT COUNT(*) as c FROM invoices`)).rows[0].c);
  const totalOutstanding = round2(
    Number(
      (
        await pool.query(`SELECT COALESCE(SUM(total - "paidAmount"),0) as s FROM invoices WHERE status IN ('issued','partial')`)
      ).rows[0].s
    )
  );
  const totalCollected = round2(
    Number((await pool.query(`SELECT COALESCE(SUM("paidAmount"),0) as s FROM invoices`)).rows[0].s)
  );
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRevenue = round2(
    Number(
      (
        await pool.query(`SELECT COALESCE(SUM(total),0) as s FROM invoices WHERE substring("issueDate",1,7)=$1`, [
          thisMonth,
        ])
      ).rows[0].s
    )
  );
  const totalClients = Number((await pool.query(`SELECT COUNT(*) as c FROM clients`)).rows[0].c);
  return { totalInvoices, totalOutstanding, totalCollected, monthRevenue, totalClients };
}

// ---------- Rapoarte avansate ----------
export type DateRange = { from?: string; to?: string };

function dateFilter(range: DateRange | undefined, col: string, startIndex: number) {
  const clauses: string[] = [];
  const params: string[] = [];
  let idx = startIndex;
  if (range?.from) {
    clauses.push(`${col} >= $${idx++}`);
    params.push(range.from);
  }
  if (range?.to) {
    clauses.push(`${col} <= $${idx++}`);
    params.push(range.to);
  }
  return { where: clauses.length ? "AND " + clauses.join(" AND ") : "", params };
}

export async function getSalesByProduct(range?: DateRange) {
  const pool = await ready();
  const { where, params } = dateFilter(range, `i."issueDate"`, 1);
  const { rows } = await pool.query(
    `SELECT it.description as name, SUM(it.qty) as qty, SUM(it.valoare) as total, SUM(it."vatValue") as vat
     FROM invoice_items it
     JOIN invoices i ON i.id = it."invoiceId"
     WHERE i.status != 'canceled' ${where}
     GROUP BY it.description
     ORDER BY total DESC`,
    params
  );
  return rows.map((r) => ({ name: r.name, qty: Number(r.qty), total: Number(r.total), vat: Number(r.vat) })) as {
    name: string;
    qty: number;
    total: number;
    vat: number;
  }[];
}

export async function getProfitByProduct(range?: DateRange) {
  const pool = await ready();
  const { where, params } = dateFilter(range, `i."issueDate"`, 1);
  const { rows } = await pool.query(
    `SELECT it.description as name, SUM(it.qty) as qty, SUM(it.valoare) as revenue,
            SUM(it.qty * COALESCE(p.cost, 0)) as cost,
            (SUM(it.valoare) - SUM(it.qty * COALESCE(p.cost, 0))) as profit
     FROM invoice_items it
     JOIN invoices i ON i.id = it."invoiceId"
     LEFT JOIN products p ON p.id = it."productId"
     WHERE i.status != 'canceled' ${where}
     GROUP BY it.description
     ORDER BY profit DESC`,
    params
  );
  return rows.map((r) => ({
    name: r.name,
    qty: Number(r.qty),
    revenue: Number(r.revenue),
    cost: Number(r.cost),
    profit: Number(r.profit),
  })) as { name: string; qty: number; revenue: number; cost: number; profit: number }[];
}

export async function getSalesByAgent(range?: DateRange) {
  const pool = await ready();
  const { where, params } = dateFilter(range, `i."issueDate"`, 1);
  const { rows } = await pool.query(
    `SELECT COALESCE(u.name, 'Fara utilizator') as name, COUNT(i.id) as "invoiceCount",
            SUM(i.total) as total, SUM(i."paidAmount") as collected
     FROM invoices i
     LEFT JOIN users u ON u.id = i."userId"
     WHERE i.status != 'canceled' ${where}
     GROUP BY i."userId", u.name
     ORDER BY total DESC`,
    params
  );
  return rows.map((r) => ({
    name: r.name,
    invoiceCount: Number(r.invoiceCount),
    total: Number(r.total),
    collected: Number(r.collected),
  })) as { name: string; invoiceCount: number; total: number; collected: number }[];
}

export async function getOverdueInvoices() {
  const pool = await ready();
  const today = new Date().toISOString().slice(0, 10);
  const { rows } = await pool.query(
    `SELECT i.*, c.name as "clientName" FROM invoices i
     JOIN clients c ON c.id = i."clientId"
     WHERE i.status IN ('issued','partial') AND i."dueDate" IS NOT NULL AND i."dueDate" != '' AND i."dueDate" < $1
     ORDER BY i."dueDate" ASC`,
    [today]
  );
  return rows as (Invoice & { clientName: string })[];
}

export async function getOutstandingByClient() {
  const pool = await ready();
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.flagged, ROUND(CAST(SUM(i.total - i."paidAmount") AS numeric), 2) as outstanding, COUNT(i.id) as "invoiceCount"
     FROM invoices i
     JOIN clients c ON c.id = i."clientId"
     WHERE i.status IN ('issued','partial')
     GROUP BY c.id
     HAVING SUM(i.total - i."paidAmount") > 0
     ORDER BY outstanding DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    flagged: r.flagged,
    outstanding: Number(r.outstanding),
    invoiceCount: Number(r.invoiceCount),
  })) as { id: number; name: string; flagged: number; outstanding: number; invoiceCount: number }[];
}
