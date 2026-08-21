import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { getConnectionAccess } from '@/lib/connection-access'
import { ensureConnectionReceptionStorage } from '@/lib/connection-reception-storage'

function cellText(value: ExcelJS.CellValue) {
  if (value == null) return ''
  if (value instanceof Date) return value.toLocaleDateString('ro-RO')
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text || '').trim()
    if ('result' in value) return String(value.result || '').trim()
    if ('richText' in value) return value.richText.map((part) => part.text).join('').trim()
  }
  return String(value).trim()
}

export async function POST(request: NextRequest) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate importa registrul.' }, { status: 403 })
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Selectează fișierul Excel.' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Fișierul depășește 10 MB.' }, { status: 400 })

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer() as unknown as Parameters<typeof workbook.xlsx.load>[0])
  const sheet = workbook.getWorksheet('Sheet1') || workbook.worksheets.find((item) => item.rowCount > 0)
  if (!sheet) return NextResponse.json({ error: 'Fișierul nu conține nicio foaie.' }, { status: 400 })

  let currentYear = 2022
  const rows: Array<Record<string, string | number | boolean>> = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const first = cellText(row.getCell(1).value)
    const yearMarker = cellText(row.getCell(3).value)
    const detectedYear = Number.parseInt(yearMarker, 10)
    const populated = [2, 3, 4, 5, 6, 7, 8].some((column) => cellText(row.getCell(column).value))
    if (/^20\d{2}$/.test(yearMarker) && !first && !cellText(row.getCell(2).value)) {
      currentYear = detectedYear
      return
    }
    if (!populated) return
    const orderNumber = Number.parseInt(first, 10)
    if (!Number.isFinite(orderNumber)) return
    const receivedText = cellText(row.getCell(8).value).toLocaleLowerCase('ro-RO')
    rows.push({
      sourceRow: rowNumber,
      year: currentYear,
      orderNumber,
      workType: cellText(row.getCell(2).value),
      beneficiary: cellText(row.getCell(3).value),
      location: cellText(row.getCell(4).value),
      lot: cellText(row.getCell(5).value),
      approvalNumber: cellText(row.getCell(6).value),
      expirationDate: cellText(row.getCell(7).value),
      received: ['da', 'receptionat', 'recepționat', 'x'].includes(receivedText),
    })
  })
  if (!rows.length) return NextResponse.json({ error: 'Nu am găsit poziții valide în registru.' }, { status: 400 })

  await ensureConnectionReceptionStorage(access.businessId)
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "ConnectionReception" WHERE "businessId"=${access.businessId} AND "sourceKey" LIKE 'Receptii.xlsx:%'`
    await tx.$executeRaw`
      INSERT INTO "ConnectionReception" (
        "id", "businessId", "sourceKey", "year", "orderNumber", "workType", "beneficiary",
        "location", "lot", "approvalNumber", "expirationDate", "received", "receivedAt", "notes"
      )
      SELECT
        ${access.businessId} || ':reception:' || source."sourceRow"::text,
        ${access.businessId}, 'Receptii.xlsx:' || source."sourceRow"::text,
        source."year", source."orderNumber", source."workType", source."beneficiary",
        source."location", source."lot", source."approvalNumber", source."expirationDate",
        source."received", CASE WHEN source."received" THEN CURRENT_TIMESTAMP ELSE NULL END, ''
      FROM jsonb_to_recordset(CAST(${JSON.stringify(rows)} AS jsonb)) AS source(
        "sourceRow" INTEGER, "year" INTEGER, "orderNumber" INTEGER, "workType" TEXT,
        "beneficiary" TEXT, "location" TEXT, "lot" TEXT, "approvalNumber" TEXT,
        "expirationDate" TEXT, "received" BOOLEAN
      )
      ON CONFLICT ("businessId", "sourceKey") DO UPDATE SET
        "year"=EXCLUDED."year", "orderNumber"=EXCLUDED."orderNumber", "workType"=EXCLUDED."workType",
        "beneficiary"=EXCLUDED."beneficiary", "location"=EXCLUDED."location", "lot"=EXCLUDED."lot",
        "approvalNumber"=EXCLUDED."approvalNumber", "expirationDate"=EXCLUDED."expirationDate",
        "received"=EXCLUDED."received", "receivedAt"=EXCLUDED."receivedAt", "updatedAt"=CURRENT_TIMESTAMP
    `
  })
  return NextResponse.json({ success: true, imported: rows.length })
}
