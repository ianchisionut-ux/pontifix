import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseSeapExport, type SeapRow } from '@/lib/seap-import'
import { ensureTenderStorage, listTenders } from '@/lib/tenders'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  if (!['OWNER', 'SUPER_ADMIN'].includes((session as any)?.role)) return NextResponse.json({ error: 'Nu ai permisiunea de import.' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Alege un fișier Excel sau CSV.' }, { status: 400 })
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Fișierul depășește limita de 4 MB.' }, { status: 413 })
  let parsed: ReturnType<typeof parseSeapExport>
  try { parsed = parseSeapExport(file.name, new Uint8Array(await file.arrayBuffer())) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Fișierul nu a putut fi citit.' }, { status: 400 }) }
  if (parsed.rows.length === 0) return NextResponse.json({ error: 'Nu am găsit anunțuri valide cu termen de depunere.' }, { status: 400 })
  await ensureTenderStorage()
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId}))::text AS lock`
    const existing = await tx.$queryRaw<(SeapRow & { id: string })[]>`
      SELECT "id", "noticeNumber", "title", "publicationDate", "deadline", "estimatedValue", "currency",
        "contractingAuthority", "procedureType", "cpvCode"
      FROM "Tender" WHERE "businessId"=${businessId} AND "noticeNumber" IS NOT NULL
    `
    const byNumber = new Map(existing.map(row => [row.noticeNumber!.trim().toUpperCase(), row]))
    const inFile = new Set<string>()
    const fresh: SeapRow[] = []
    let duplicates = 0, updated = 0
    for (const row of parsed.rows) {
      if (inFile.has(row.noticeNumber)) { duplicates++; continue }
      inFile.add(row.noticeNumber)
      const previous = byNumber.get(row.noticeNumber)
      if (!previous) { fresh.push(row); continue }
      const changed = (['title', 'publicationDate', 'deadline', 'estimatedValue', 'currency', 'contractingAuthority', 'procedureType', 'cpvCode'] as const)
        .some(field => previous[field] !== row[field])
      if (!changed) { duplicates++; continue }
      await tx.$executeRaw`
        UPDATE "Tender" SET "title"=${row.title}, "publicationDate"=${row.publicationDate},
          "deadline"=${row.deadline}, "estimatedValue"=${row.estimatedValue}, "currency"=${row.currency},
          "contractingAuthority"=${row.contractingAuthority}, "procedureType"=${row.procedureType},
          "cpvCode"=${row.cpvCode}, "updatedAt"=NOW()
        WHERE "id"=${previous.id} AND "businessId"=${businessId}
      `
      updated++
    }
    for (let i = 0; i < fresh.length; i += 100) {
      const batch = fresh.slice(i, i + 100)
      const values = batch.map(row => Prisma.sql`(${randomUUID()}, ${businessId}, ${row.title}, ${row.noticeNumber}, ${row.contractingAuthority}, ${row.procedureType}, ${row.cpvCode}, ${row.publicationDate}, ${row.deadline}, ${row.estimatedValue}, ${row.currency}, 'NESELECTATA')`)
      await tx.$executeRaw(Prisma.sql`INSERT INTO "Tender" ("id", "businessId", "title", "noticeNumber", "contractingAuthority", "procedureType", "cpvCode", "publicationDate", "deadline", "estimatedValue", "currency", "status") VALUES ${Prisma.join(values)}`)
    }
    return { imported: fresh.length, updated, duplicates }
  }, { maxWait: 10_000, timeout: 30_000 })
  return NextResponse.json({ ...result, invalid: parsed.invalid, tenders: await listTenders(businessId) })
}
