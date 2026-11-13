import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { PDFDocument } from 'pdf-lib'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDeerSigningStorage, newSigningId, newSigningToken, sha256, signingTokenHash, type SigningRequestRow } from '@/lib/deer-signing'
import type { SigningDocument } from '@/lib/deer-signing-bundle'

export const runtime = 'nodejs'
export const maxDuration = 60

async function access(connectionId: string) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId || (session as any)?.role !== 'SUPER_ADMIN') return null
  const rows = await prisma.$queryRaw<Array<{ nib: string; fields: Record<string, string> }>>`
    SELECT "nib", "fields" FROM "ConnectionCase" WHERE "id"=${connectionId} AND "businessId"=${businessId} LIMIT 1`
  return rows[0] ? { businessId, email: session?.user?.email || null, ...rows[0] } : null
}

export async function GET(request: NextRequest) {
  const connectionId = request.nextUrl.searchParams.get('connectionId') || ''
  const user = await access(connectionId)
  if (!user) return NextResponse.json({ error: 'Acces interzis.' }, { status: 403 })
  await ensureDeerSigningStorage()
  const rows = await prisma.$queryRaw<Array<Pick<SigningRequestRow, 'id' | 'documents' | 'createdAt' | 'expiresAt' | 'revokedAt' | 'completedAt' | 'acceptedName' | 'signedPathname'>>>`
    SELECT "id", "documents", "createdAt", "expiresAt", "revokedAt", "completedAt", "acceptedName", "signedPathname"
    FROM "DeerSigningRequest" WHERE "businessId"=${user.businessId} AND "connectionId"=${connectionId}
    ORDER BY "createdAt" DESC LIMIT 10`
  return NextResponse.json({ requests: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const connectionId = typeof body?.connectionId === 'string' ? body.connectionId : ''
  const user = await access(connectionId)
  if (!user) return NextResponse.json({ error: 'Acces interzis.' }, { status: 403 })
  const pathname = typeof body?.bundlePathname === 'string' ? body.bundlePathname : ''
  const hash = typeof body?.bundleHash === 'string' ? body.bundleHash : ''
  const documents = body?.documents as SigningDocument[]
  if (!pathname.startsWith(`formulare/deer-signing/${connectionId}/`) || !/^[a-f0-9]{64}$/.test(hash) || !Array.isArray(documents) || !documents.length || documents.length > 30) {
    return NextResponse.json({ error: 'Pachetul de documente este invalid.' }, { status: 400 })
  }
  try {
    await ensureDeerSigningStorage()
    const templates = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "FormTemplate" WHERE "businessId"=${user.businessId} AND "category"='DEER' AND "id" IN (${Prisma.join(documents.map((item) => item.id))})`
    if (templates.length !== documents.length || new Set(documents.map((item) => item.id)).size !== documents.length) throw new Error('Lista documentelor nu corespunde șabloanelor DEER.')
    const source = await get(pathname, { access: 'private' })
    if (!source?.stream) throw new Error('PDF-ul încărcat nu este disponibil.')
    const bytes = new Uint8Array(await new Response(source.stream).arrayBuffer())
    if (bytes.length > 20 * 1024 * 1024 || sha256(bytes) !== hash) throw new Error('PDF-ul încărcat nu corespunde versiunii pregătite.')
    const pdf = await PDFDocument.load(bytes)
    let expectedPage = 1
    let signatureCount = 0
    for (const item of documents) {
      if (typeof item.title !== 'string' || item.title.length > 180 || item.firstPage !== expectedPage || !Number.isInteger(item.pageCount) || item.pageCount < 1 || !Array.isArray(item.signatures)) throw new Error('Lista paginilor este invalidă.')
      for (const mark of item.signatures) {
        if (![mark.page, mark.x, mark.y, mark.width, mark.height, mark.rotation].every(Number.isFinite) || mark.page < item.firstPage || mark.page >= item.firstPage + item.pageCount || mark.x < 0 || mark.y < 0 || mark.width <= 0 || mark.height <= 0 || mark.x + mark.width > 1.01 || mark.y + mark.height > 1.01) throw new Error('Poziția semnăturii este invalidă.')
        signatureCount++
      }
      expectedPage += item.pageCount
    }
    if (expectedPage - 1 !== pdf.getPageCount() || !signatureCount || signatureCount > 80) throw new Error('Paginile sau pozițiile de semnare nu corespund PDF-ului.')
    const token = newSigningToken()
    const id = newSigningId()
    const beneficiaryName = String(user.fields?.Beneficiar || '').trim()
    if (beneficiaryName.length < 3) throw new Error('Beneficiarul nu este completat în dosar.')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "DeerSigningRequest" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "businessId"=${user.businessId} AND "connectionId"=${connectionId} AND "completedAt" IS NULL AND "revokedAt" IS NULL`
      await tx.$executeRaw`INSERT INTO "DeerSigningRequest" ("id", "businessId", "connectionId", "tokenHash", "beneficiaryName", "nib", "bundlePathname", "bundleHash", "documents", "createdByEmail", "expiresAt")
        VALUES (${id}, ${user.businessId}, ${connectionId}, ${signingTokenHash(token)}, ${beneficiaryName}, ${user.nib}, ${pathname}, ${hash}, ${JSON.stringify(documents)}::jsonb, ${user.email}, ${expiresAt})`
    })
    return NextResponse.json({ id, link: `${request.nextUrl.origin}/semneaza/${token}`, expiresAt })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Linkul nu a putut fi creat.' }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const connectionId = typeof body?.connectionId === 'string' ? body.connectionId : ''
  const id = typeof body?.id === 'string' ? body.id : ''
  const user = await access(connectionId)
  if (!user) return NextResponse.json({ error: 'Acces interzis.' }, { status: 403 })
  await ensureDeerSigningStorage()
  await prisma.$executeRaw`UPDATE "DeerSigningRequest" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "businessId"=${user.businessId} AND "connectionId"=${connectionId} AND "completedAt" IS NULL`
  return NextResponse.json({ success: true })
}
