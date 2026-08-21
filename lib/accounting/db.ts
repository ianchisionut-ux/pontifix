import { Pool } from "pg";

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
     VALUES (1, 'ELMONT S.A.', 'J1997000155315', '9710508', 'Str. 22 Decembrie 1989, Nr. 113, Zalău, Sălaj', '0260-611133', 'elmont_zalau@yahoo.com')
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
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS "sourceConnectionId" TEXT;`);
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS "sourceNib" TEXT NOT NULL DEFAULT '';`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "clients_sourceConnectionId_key" ON clients ("sourceConnectionId") WHERE "sourceConnectionId" IS NOT NULL;`);
}

export function getPool(): Pool {
  if (!global.__facturarePool) {
    global.__facturarePool = createPool();
  }
  if (!global.__facturareSchemaReady) {
    global.__facturareSchemaReady = ensureSchema(global.__facturarePool).catch((err) => {
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
