import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureTenderStorage, listTenders } from '@/lib/tenders'

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform(value => value || null)
const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine(value => !Number.isNaN(new Date(value).getTime()), 'Dată invalidă')
const schema = z.object({
  title: z.string().trim().min(3).max(300),
  noticeNumber: optionalText(80),
  contractingAuthority: optionalText(250),
  procedureType: optionalText(120),
  cpvCode: optionalText(120),
  publicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().transform(value => value || null),
  deadline: dateTime,
  estimatedValue: z.number().nonnegative().finite().nullable(),
  currency: z.enum(['RON', 'EUR']).default('RON'),
  status: z.enum(['NESELECTATA', 'INTERES', 'PREGATIRE', 'DEPUSA', 'CASTIGATA', 'PIERDUTA', 'ANULATA']).default('NESELECTATA'),
  seapUrl: z.union([z.literal(''), z.string().url().max(1000).refine(value => { try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'e-licitatie.ro' || url.hostname === 'www.e-licitatie.ro') } catch { return false } }, 'Folosește un link SEAP valid')]).optional().nullable().transform(value => value || null),
  notes: optionalText(5000),
})

async function access(write = false) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return { error: NextResponse.json({ error: 'Neautorizat' }, { status: 401 }) }
  if (write && !['OWNER', 'SUPER_ADMIN'].includes((session as any)?.role)) return { error: NextResponse.json({ error: 'Nu ai permisiunea să modifici licitațiile.' }, { status: 403 }) }
  return { businessId }
}

export async function GET() {
  const result = await access()
  if (result.error) return result.error
  return NextResponse.json(await listTenders(result.businessId!))
}

export async function POST(req: NextRequest) {
  const result = await access(true)
  if (result.error) return result.error
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Verifică datele introduse, în special termenul și linkul SEAP.' }, { status: 400 })
  await ensureTenderStorage()
  const d = parsed.data
  await prisma.$executeRaw`
    INSERT INTO "Tender" ("id", "businessId", "title", "noticeNumber", "contractingAuthority", "procedureType", "cpvCode", "publicationDate", "deadline", "estimatedValue", "currency", "status", "seapUrl", "notes")
    VALUES (${randomUUID()}, ${result.businessId!}, ${d.title}, ${d.noticeNumber}, ${d.contractingAuthority}, ${d.procedureType}, ${d.cpvCode}, ${d.publicationDate}, ${d.deadline}, ${d.estimatedValue}, ${d.currency}, ${d.status}, ${d.seapUrl}, ${d.notes})
  `
  return NextResponse.json(await listTenders(result.businessId!), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const result = await access(true)
  if (result.error) return result.error
  const body = await req.json().catch(() => null)
  const id = z.string().uuid().safeParse(body?.id)
  const parsed = schema.safeParse(body)
  if (!id.success || !parsed.success) return NextResponse.json({ error: 'Verifică datele licitației.' }, { status: 400 })
  await ensureTenderStorage()
  const d = parsed.data
  const count = await prisma.$executeRaw`
    UPDATE "Tender" SET "title"=${d.title}, "noticeNumber"=${d.noticeNumber}, "contractingAuthority"=${d.contractingAuthority},
      "procedureType"=${d.procedureType}, "cpvCode"=${d.cpvCode}, "publicationDate"=${d.publicationDate},
      "deadline"=${d.deadline}, "estimatedValue"=${d.estimatedValue}, "currency"=${d.currency},
      "status"=${d.status}, "seapUrl"=${d.seapUrl}, "notes"=${d.notes}, "updatedAt"=NOW()
    WHERE "id"=${id.data} AND "businessId"=${result.businessId!}
  `
  if (!count) return NextResponse.json({ error: 'Licitația nu a fost găsită.' }, { status: 404 })
  return NextResponse.json(await listTenders(result.businessId!))
}

export async function DELETE(req: NextRequest) {
  const result = await access(true)
  if (result.error) return result.error
  const body = await req.json().catch(() => null)
  const id = z.string().uuid().safeParse(body?.id)
  if (!id.success) return NextResponse.json({ error: 'Identificator invalid.' }, { status: 400 })
  await ensureTenderStorage()
  await prisma.$executeRaw`DELETE FROM "Tender" WHERE "id"=${id.data} AND "businessId"=${result.businessId!}`
  return NextResponse.json(await listTenders(result.businessId!))
}
