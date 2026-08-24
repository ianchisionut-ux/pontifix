import { prisma } from '@/lib/prisma'

const INITIAL_FORMS = [
  ['proces-verbal-receptie-terminarea-lucrarilor', 'Proces-verbal de recepție la terminarea lucrărilor', 'proces-verbal-receptie-terminarea-lucrarilor.pdf'],
  ['buletin-verificare-prize-pamant', 'Buletin de verificare - prize de pământ', 'buletin-verificare-prize-pamant.pdf'],
  ['declaratie-conformitate-calitatea-lucrarilor', 'Declarație de conformitate privind calitatea lucrărilor', 'declaratie-conformitate-calitatea-lucrarilor.pdf'],
  ['proces-verbal-receptie-lucrari-ascunse', 'Proces-verbal de recepție calitativă a lucrărilor ascunse', 'proces-verbal-receptie-lucrari-ascunse.pdf'],
  ['buletin-verificare-incercari-cabluri', 'Buletin de verificare - încercări de cabluri', 'buletin-verificare-incercari-cabluri.pdf'],
] as const

export type FormField = {
  id: string; label: string; page: number; x: number; y: number
  width: number; height: number; fontSize: number; multiline?: boolean
  binding?: string; defaultValue?: string
}

export type StampPlacement = {
  id: string; stampKey: string; page: number; x: number; y: number
  width: number; height: number; rotation: number
}

const ZALAU_REQUEST_FIELDS: FormField[] = [
  { id: 'obiect', label: 'Obiectul lucrării', page: 1, x: .197, y: .271, width: .69, height: .025, fontSize: 12, binding: 'connection.object' },
  { id: 'ocupare', label: 'Suprafață / tip zonă ocupată', page: 1, x: .342, y: .357, width: .28, height: .024, fontSize: 12, defaultValue: 'spații verzi' },
  { id: 'data_inceput', label: 'Data începerii', page: 1, x: .109, y: .482, width: .15, height: .024, fontSize: 12 },
  { id: 'data_final', label: 'Data finalizării', page: 1, x: .453, y: .484, width: .15, height: .024, fontSize: 12 },
  { id: 'firma', label: 'Executant', page: 1, x: .544, y: .517, width: .22, height: .024, fontSize: 12, defaultValue: 'SC ELMONT S.A.' },
  { id: 'firma_oras', label: 'Localitatea firmei', page: 1, x: .242, y: .536, width: .12, height: .024, fontSize: 12, defaultValue: 'Zalău' },
  { id: 'firma_strada', label: 'Strada firmei', page: 1, x: .416, y: .537, width: .24, height: .024, fontSize: 12, defaultValue: '22 Decembrie 1989' },
  { id: 'firma_numar', label: 'Numărul sediului', page: 1, x: .668, y: .538, width: .08, height: .024, fontSize: 12, defaultValue: '113' },
  { id: 'firma_telefon', label: 'Telefonul firmei', page: 1, x: .665, y: .554, width: .19, height: .024, fontSize: 12, defaultValue: '0727700062' },
  { id: 'beneficiar', label: 'Beneficiar', page: 1, x: .494, y: .575, width: .32, height: .025, fontSize: 12, binding: 'connection.Beneficiar' },
  { id: 'beneficiar_oras', label: 'Localitatea beneficiarului', page: 1, x: .25, y: .591, width: .18, height: .024, fontSize: 12, binding: 'connection.Oras' },
  { id: 'beneficiar_telefon', label: 'Telefonul beneficiarului', page: 1, x: .104, y: .607, width: .2, height: .024, fontSize: 12, binding: 'connection.Telefon' },
  { id: 'reprezentant', label: 'Reprezentant', page: 1, x: .666, y: .642, width: .27, height: .024, fontSize: 12, defaultValue: 'Ianchis Ionuț Cristian' },
  { id: 'reprezentant_oras', label: 'Localitatea reprezentantului', page: 1, x: .334, y: .659, width: .14, height: .024, fontSize: 12, defaultValue: 'Zalău' },
  { id: 'judet', label: 'Județ', page: 1, x: .219, y: .677, width: .14, height: .024, fontSize: 12, binding: 'connection.Judet' },
]
const REQUESTS = [
  ['primaria-zalau-bransament', 'Cerere branșament - Primăria Zalău', 'cerere-bransament-primaria-zalau.pdf', ZALAU_REQUEST_FIELDS],
  ['citadin-zalau', 'Cerere Citadin Zalău', 'cerere-citadin-zalau.pdf', []],
  ['apa-somes', 'Cerere aviz Apă Someș', 'cerere-aviz-apa-somes.pdf', []],
  ['delgaz-grid', 'Cerere aviz Delgaz Grid', 'cerere-aviz-delgaz-grid.pdf', []],
  ['orange', 'Cerere aviz Orange', 'cerere-aviz-orange.pdf', []],
] as const

let tableReady: Promise<void> | null = null
async function ensureTable() {
  if (!tableReady) {
    tableReady = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "FormTemplate" (
      "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "title" TEXT NOT NULL,
      "category" TEXT NOT NULL DEFAULT 'FORMULAR', "documentPathname" TEXT NOT NULL,
      "documentName" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "fieldSchema" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
    )`).then(async () => {
      await prisma.$executeRawUnsafe(`ALTER TABLE "FormTemplate" ADD COLUMN IF NOT EXISTS "fieldSchema" JSONB NOT NULL DEFAULT '[]'::jsonb`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "FormTemplate" ADD COLUMN IF NOT EXISTS "stampSchema" JSONB NOT NULL DEFAULT '[]'::jsonb`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FormTemplate_businessId_category_sortOrder_idx" ON "FormTemplate"("businessId", "category", "sortOrder")`)
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "FormSubmission" (
        "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "formTemplateId" TEXT NOT NULL,
        "title" TEXT NOT NULL, "sourceType" TEXT, "sourceId" TEXT,
        "values" JSONB NOT NULL DEFAULT '{}'::jsonb, "fieldSchema" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
      )`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FormSubmission_businessId_updatedAt_idx" ON "FormSubmission"("businessId", "updatedAt" DESC)`)
    }).catch((error) => { tableReady = null; throw error })
  }
  await tableReady
}

export async function ensureFormStorage(businessId: string) {
  await ensureTable()
  for (let index = 0; index < INITIAL_FORMS.length; index++) {
    const [slug, title, filename] = INITIAL_FORMS[index]
    await prisma.$executeRaw`
      INSERT INTO "FormTemplate" ("id", "businessId", "title", "category", "documentPathname", "documentName", "sortOrder")
      VALUES (${`${businessId}:formular:${slug}`}, ${businessId}, ${title}, 'FORMULAR', ${`asset:${filename}`}, ${filename}, ${index})
      ON CONFLICT ("id") DO NOTHING`
  }
  for (let index = 0; index < REQUESTS.length; index++) {
    const [slug, title, filename, fields] = REQUESTS[index]
    await prisma.$executeRaw`
      INSERT INTO "FormTemplate" ("id", "businessId", "title", "category", "documentPathname", "documentName", "sortOrder", "fieldSchema")
      VALUES (${`${businessId}:cerere:${slug}`}, ${businessId}, ${title}, 'CERERE', ${`asset:${filename}`}, ${filename}, ${index}, ${JSON.stringify(fields)}::jsonb)
      ON CONFLICT ("id") DO NOTHING`
  }
}

export type FormTemplateDto = {
  id: string; title: string; category: 'FORMULAR' | 'CERERE' | 'SEMNARE'
  documentPathname: string; documentName: string; sortOrder: number
  fieldSchema: FormField[]; stampSchema: StampPlacement[]; updatedAt: string
}
export type FormSubmissionDto = {
  id: string; formTemplateId: string; title: string; sourceType: string | null; sourceId: string | null
  values: Record<string, string>; fieldSchema: FormField[]; createdAt: string; updatedAt: string
}
