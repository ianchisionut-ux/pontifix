import { Pool } from "pg";

const ACCOUNTING_SCHEMA_VERSION = 12;

declare global {
  // eslint-disable-next-line no-var
  var __facturarePool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __facturareSchemaReady: Promise<void> | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL nu este setat. Adauga conexiunea Postgres (Neon) in .env.local (local) sau in Environment Variables (Vercel)."
    );
  }
  return new Pool({
    connectionString,
    // Neon (si majoritatea furnizorilor Postgres gazduiti) cer SSL.
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 5,
  });
}

async function ensureSchema(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT NOT NULL DEFAULT '',
      "regCom" TEXT NOT NULL DEFAULT '',
      cif TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      iban TEXT NOT NULL DEFAULT '',
      "iban2" TEXT NOT NULL DEFAULT '',
      "iban3" TEXT NOT NULL DEFAULT '',
      bank TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      "vatIncasare" INTEGER NOT NULL DEFAULT 1,
      CONSTRAINT company_single_row CHECK (id = 1)
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      ci TEXT NOT NULL DEFAULT '',
      cnp TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      "regCom" TEXT NOT NULL DEFAULT '',
      cif TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      judet TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      flagged INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      um TEXT NOT NULL DEFAULT 'buc',
      price DOUBLE PRECISION NOT NULL DEFAULT 0,
      cost DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 21
    );

    CREATE TABLE IF NOT EXISTS counters (
      series TEXT PRIMARY KEY,
      "lastNumber" INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      series TEXT NOT NULL,
      number INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL REFERENCES clients(id),
      "userId" INTEGER REFERENCES users(id),
      "issueDate" TEXT NOT NULL,
      "dueDate" TEXT,
      status TEXT NOT NULL DEFAULT 'issued',
      "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
      total DOUBLE PRECISION NOT NULL DEFAULT 0,
      "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'RON',
      "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
      notes TEXT NOT NULL DEFAULT '',
      "delegateName" TEXT NOT NULL DEFAULT '',
      "delegateCI" TEXT NOT NULL DEFAULT '',
      "delegateCNP" TEXT NOT NULL DEFAULT '',
      "vehiclePlate" TEXT NOT NULL DEFAULT '',
      "deliveryDate" TEXT NOT NULL DEFAULT '',
      "deliveryTime" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(series, number)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      "invoiceId" INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      "productId" INTEGER REFERENCES products(id),
      description TEXT NOT NULL,
      um TEXT NOT NULL DEFAULT 'buc',
      qty DOUBLE PRECISION NOT NULL DEFAULT 1,
      "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
      valoare DOUBLE PRECISION NOT NULL DEFAULT 0,
      "vatValue" DOUBLE PRECISION NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id SERIAL PRIMARY KEY,
      series TEXT NOT NULL DEFAULT 'CH1',
      number INTEGER NOT NULL,
      "invoiceId" INTEGER NOT NULL REFERENCES invoices(id),
      "issueDate" TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      cashier TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(series, number)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      "invoiceId" INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'numerar',
      notes TEXT NOT NULL DEFAULT ''
    );
  `);

  await pool.query(
    `INSERT INTO company (id, name, "regCom", cif, address, phone, email)
     VALUES (1, 'ELMONT S.A.', '', '9710508', 'Str. 22 Decembrie 1989, Nr. 113', '0260-611133', 'elmont_zalau@yahoo.com')
     ON CONFLICT (id) DO NOTHING;`
  );

  // Migrare: cota standard de TVA in Romania a crescut la 21% (din 1 august
  // 2025, OUG 156/2024). Actualizam doar valoarea implicita a coloanei
  // (pentru randuri noi) — nu modificam facturile deja emise, care trebuie
  // sa ramana cu cota aplicata la data emiterii.
  await pool.query(`ALTER TABLE products ALTER COLUMN "vatRate" SET DEFAULT 21;`);
  await pool.query(`ALTER TABLE invoice_items ALTER COLUMN "vatRate" SET DEFAULT 21;`);

  // Date extinse de identificare si legatura stabila cu dosarul de bransament.
  // Coloanele sunt adaugate incremental pentru bazele deja existente in productie.
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS "clientType" TEXT NOT NULL DEFAULT 'PJ';`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnp TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS "ciSeries" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS "ciNumber" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS "iban2" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS "iban3" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS "vatPayer" INTEGER NOT NULL DEFAULT 1;`);
  await pool.query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'RO';`);
  await pool.query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS county TEXT NOT NULL DEFAULT 'Salaj';`);
  await pool.query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'Zalau';`);
  await pool.query(`ALTER TABLE company ADD COLUMN IF NOT EXISTS "postalCode" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS "vatPayer" INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'RO';`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS "postalCode" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS "sourceConnectionId" TEXT;`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS "sourceNib" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "clients_sourceConnectionId_key" ON clients ("sourceConnectionId") WHERE "sourceConnectionId" IS NOT NULL;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "invoiceType" TEXT NOT NULL DEFAULT 'STANDARD';`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "originalInvoiceId" INTEGER REFERENCES invoices(id);`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "stornoReason" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS "unitCode" TEXT NOT NULL DEFAULT 'H87';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS "vatCategoryCode" TEXT NOT NULL DEFAULT 'S';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS "taxExemptionReasonCode" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS "taxExemptionReason" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS "unitCode" TEXT NOT NULL DEFAULT 'H87';`);
  await pool.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS "vatCategoryCode" TEXT NOT NULL DEFAULT 'S';`);
  await pool.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS "taxExemptionReasonCode" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS "taxExemptionReason" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "invoiceTypeCode" TEXT NOT NULL DEFAULT '380';`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paymentMeansCode" TEXT NOT NULL DEFAULT '30';`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "taxPointDate" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "buyerReference" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "sellerSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "clientSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb;`);
  // Default 0 is intentional: invoices that existed before this migration must
  // never be picked up by the automatic sender. Only newly issued invoices are
  // explicitly opted in inside createInvoice().
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "autoEfactura" INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "anafSendAfter" TIMESTAMPTZ;`);
  // No backfill: historical test invoices require explicit approval for the target environment.
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "anafApprovedEnvironment" TEXT;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "integrationSource" TEXT;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "externalId" TEXT;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "invoices_integration_reference_key" ON invoices ("integrationSource", "externalId") WHERE "integrationSource" IS NOT NULL AND "externalId" IS NOT NULL;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "invoices_one_storno_per_original" ON invoices ("originalInvoiceId") WHERE "invoiceType"='STORNO';`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ref_transactions (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
      date DATE NOT NULL,
      "documentType" TEXT NOT NULL,
      "documentNumber" TEXT NOT NULL DEFAULT '',
      explanation TEXT NOT NULL,
      "grossAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
      "vatAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
      "netAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
      "fiscalCategory" TEXT NOT NULL,
      "deductibilityPercent" NUMERIC(5,2) NOT NULL DEFAULT 100,
      "fiscalAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
      "invoiceId" INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      "paymentId" INTEGER REFERENCES payments(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'MANUAL',
      notes TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "ref_transactions_paymentId_key"
      ON ref_transactions ("paymentId") WHERE "paymentId" IS NOT NULL;
    CREATE INDEX IF NOT EXISTS "ref_transactions_date_idx" ON ref_transactions (date);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS anaf_connections (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id=1),
      "accessToken" TEXT NOT NULL,
      "refreshToken" TEXT NOT NULL DEFAULT '',
      "expiresAt" TIMESTAMPTZ NOT NULL,
      scope TEXT NOT NULL DEFAULT '',
      "connectedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS efactura_submissions (
      id SERIAL PRIMARY KEY,
      "invoiceId" INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      "uploadId" TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'DRAFT',
      message TEXT NOT NULL DEFAULT '',
      "downloadId" TEXT NOT NULL DEFAULT '',
      "xmlSnapshot" TEXT NOT NULL,
      "submittedAt" TIMESTAMPTZ,
      "checkedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "efactura_submissions_invoice_idx" ON efactura_submissions ("invoiceId", id DESC);
    CREATE TABLE IF NOT EXISTS efactura_messages (
      id SERIAL PRIMARY KEY,
      "messageId" TEXT NOT NULL UNIQUE,
      direction TEXT NOT NULL CHECK (direction IN ('RECEIVED','SENT')),
      cif TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      "documentDate" TEXT NOT NULL DEFAULT '',
      "downloadId" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS efactura_automation_state (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'NEVER',
      checked INTEGER NOT NULL DEFAULT 0,
      sent INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL DEFAULT '',
      "lastRunAt" TIMESTAMPTZ,
      "lastSuccessAt" TIMESTAMPTZ,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE efactura_submissions ADD COLUMN IF NOT EXISTS retryable INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE efactura_submissions ADD COLUMN IF NOT EXISTS "attemptNumber" INTEGER NOT NULL DEFAULT 1;`);
  await pool.query(`ALTER TABLE anaf_connections ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'test';`);
  await pool.query(`ALTER TABLE efactura_submissions ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'test';`);
  await pool.query(`ALTER TABLE efactura_messages ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'test';`);
  await pool.query(`ALTER TABLE efactura_messages DROP CONSTRAINT IF EXISTS "efactura_messages_messageId_key";`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "efactura_messages_environment_id_idx" ON efactura_messages (environment,"messageId");`);
  // Clean up only locally-active duplicates from older code before enforcing
  // the invariant. Validated/rejected history remains untouched.
  await pool.query(`
    UPDATE efactura_submissions older
       SET status='ERROR', retryable=0,
           message=CASE WHEN older.message='' THEN 'Înlocuită de o trimitere mai nouă.' ELSE older.message END,
           "checkedAt"=now()
     WHERE older.status IN ('UPLOADING','PROCESSING')
       AND EXISTS (
         SELECT 1 FROM efactura_submissions newer
          WHERE newer."invoiceId"=older."invoiceId"
            AND newer.environment=older.environment
            AND newer.status IN ('UPLOADING','PROCESSING')
            AND newer.id>older.id
       );
  `);
  await pool.query(`
    DROP INDEX IF EXISTS "efactura_one_active_submission_per_invoice";
    CREATE UNIQUE INDEX "efactura_one_active_submission_per_invoice"
      ON efactura_submissions ("invoiceId",environment)
      WHERE status IN ('UPLOADING','PROCESSING');
  `);
  await pool.query(`ALTER TABLE ref_transactions ADD COLUMN IF NOT EXISTS "partnerName" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE ref_transactions ADD COLUMN IF NOT EXISTS "partnerCif" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE ref_transactions ADD COLUMN IF NOT EXISTS "partnerCountryCode" TEXT NOT NULL DEFAULT 'RO';`);
  await pool.query(`ALTER TABLE ref_transactions ADD COLUMN IF NOT EXISTS "vatRate" NUMERIC(5,2);`);
  await pool.query(`ALTER TABLE ref_transactions ADD COLUMN IF NOT EXISTS "partnerVatPayer" INTEGER NOT NULL DEFAULT -1;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tax_declaration_periods (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEW','APPROVED','FILED')),
      notes TEXT NOT NULL DEFAULT '',
      "receiptNumber" TEXT NOT NULL DEFAULT '',
      "snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(year, month)
    );
    CREATE INDEX IF NOT EXISTS "tax_declaration_periods_period_idx"
      ON tax_declaration_periods (year DESC, month DESC);
    CREATE TABLE IF NOT EXISTS tax_declaration_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id=1),
      "declarantLastName" TEXT NOT NULL DEFAULT '',
      "declarantFirstName" TEXT NOT NULL DEFAULT '',
      "declarantFunction" TEXT NOT NULL DEFAULT '',
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    INSERT INTO tax_declaration_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    CREATE TABLE IF NOT EXISTS tax_declaration_classifications (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      "declarationType" TEXT NOT NULL CHECK ("declarationType" IN ('D300','D394','D390')),
      "sourceKey" TEXT NOT NULL,
      "operationCode" TEXT NOT NULL DEFAULT '',
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(year,month,"declarationType","sourceKey")
    );
    CREATE INDEX IF NOT EXISTS "tax_declaration_classifications_period_idx"
      ON tax_declaration_classifications (year DESC,month DESC,"declarationType");
  `);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS caen TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "fiscalPeriodType" TEXT NOT NULL DEFAULT 'L';`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "proRata" NUMERIC(5,2) NOT NULL DEFAULT 100;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "preparerType" INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "preparerName" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "preparerCif" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "preparerCapacity" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "consultOption" INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "affiliatedTransactions" INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "priorVatPayable" NUMERIC(14,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "priorVatRefundable" NUMERIC(14,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "inspectionVatPayable" NUMERIC(14,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "inspectionVatRefundable" NUMERIC(14,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "deductibleAdjustments" NUMERIC(14,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "refundedForeignVat" NUMERIC(14,2) NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "requestRefund" INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "profileConfirmedAt" TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "invoiceSeries" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "allocatedInvoiceFrom" INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE tax_declaration_settings ADD COLUMN IF NOT EXISTS "allocatedInvoiceTo" INTEGER NOT NULL DEFAULT 0;`);
  // Populam idempotent registrul cu incasarile deja existente in Facturare.
  await pool.query(`
    INSERT INTO ref_transactions
      (type, date, "documentType", "documentNumber", explanation, "grossAmount", "vatAmount", "netAmount",
       "fiscalCategory", "deductibilityPercent", "fiscalAmount", "invoiceId", "paymentId", source)
    SELECT 'INCOME', p.date::date, 'FACTURA', i.series || ' ' || i.number::text,
           'Incasare factura - ' || COALESCE(NULLIF(c.name,''), 'Client'),
           ROUND(p.amount::numeric, 2),
           CASE WHEN COALESCE(co."vatPayer",0)=1 AND i.total<>0
                THEN ROUND((p.amount - p.amount * i.subtotal / i.total)::numeric, 2) ELSE 0 END,
           CASE WHEN COALESCE(co."vatPayer",0)=1 AND i.total<>0
                THEN ROUND((p.amount * i.subtotal / i.total)::numeric, 2) ELSE ROUND(p.amount::numeric, 2) END,
           'TAXABLE_INCOME', 100,
           CASE WHEN COALESCE(co."vatPayer",0)=1 AND i.total<>0
                THEN ROUND((p.amount * i.subtotal / i.total)::numeric, 2) ELSE ROUND(p.amount::numeric, 2) END,
           i.id, p.id, 'AUTO_PAYMENT'
    FROM payments p
    JOIN invoices i ON i.id=p."invoiceId"
    LEFT JOIN clients c ON c.id=i."clientId"
    CROSS JOIN company co
    ON CONFLICT ("paymentId") WHERE "paymentId" IS NOT NULL DO NOTHING;
  `);
}

async function ensureSchemaVersion(pool: Pool) {
  try {
    const { rows } = await pool.query(`SELECT version FROM accounting_schema_meta WHERE id=1`);
    if (Number(rows[0]?.version || 0) >= ACCOUNTING_SCHEMA_VERSION) return;
    if (Number(rows[0]?.version) === 10) {
      // Additive upgrade only: do not rerun historical financial backfills.
      await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "anafSendAfter" TIMESTAMPTZ;`);
      await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "anafApprovedEnvironment" TEXT;`);
      await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "integrationSource" TEXT;`);
      await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "externalId" TEXT;`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "invoices_integration_reference_key" ON invoices ("integrationSource", "externalId") WHERE "integrationSource" IS NOT NULL AND "externalId" IS NOT NULL;`);
      await pool.query(`UPDATE accounting_schema_meta SET version=$1 WHERE id=1 AND version=10`, [ACCOUNTING_SCHEMA_VERSION]);
      return;
    }
    if (Number(rows[0]?.version) === 11) {
      await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "integrationSource" TEXT;`);
      await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "externalId" TEXT;`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "invoices_integration_reference_key" ON invoices ("integrationSource", "externalId") WHERE "integrationSource" IS NOT NULL AND "externalId" IS NOT NULL;`);
      await pool.query(`UPDATE accounting_schema_meta SET version=$1 WHERE id=1 AND version=11`, [ACCOUNTING_SCHEMA_VERSION]);
      return;
    }
  } catch (error) {
    if ((error as { code?: string }).code !== "42P01") throw error;
  }

  await ensureSchema(pool);
  await pool.query(`CREATE TABLE IF NOT EXISTS accounting_schema_meta (id INTEGER PRIMARY KEY, version INTEGER NOT NULL);`);
  await pool.query(
    `INSERT INTO accounting_schema_meta (id, version) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET version=EXCLUDED.version`,
    [ACCOUNTING_SCHEMA_VERSION]
  );
}

export function getPool(): Pool {
  if (!global.__facturarePool) {
    global.__facturarePool = createPool();
  }
  if (!global.__facturareSchemaReady) {
    global.__facturareSchemaReady = ensureSchemaVersion(global.__facturarePool).catch((err) => {
      // Don't leave a permanently-rejected promise cached: if this attempt
      // failed (e.g. a transient network hiccup reaching Neon), clear it so
      // the *next* request tries ensureSchema again instead of the whole
      // app staying broken until the server process restarts.
      global.__facturareSchemaReady = undefined;
      throw err;
    });
  }
  return global.__facturarePool;
}

// Call this before any query that must run after the schema is guaranteed
// to exist (every repo.ts function does this internally).
export async function ready(): Promise<Pool> {
  const pool = getPool();
  await global.__facturareSchemaReady;
  return pool;
}
