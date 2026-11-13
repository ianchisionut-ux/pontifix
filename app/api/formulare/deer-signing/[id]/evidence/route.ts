import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDeerSigningStorage } from '@/lib/deer-signing'
import type { SigningDocument } from '@/lib/deer-signing-bundle'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureDeerSigningStorage()
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ nib: string; beneficiaryName: string; acceptedName: string | null; documents: SigningDocument[]; readDocumentIds: string[] | null; createdAt: Date; completedAt: Date | null; expiresAt: Date; declaration: string | null; bundleHash: string; signedHash: string | null; signerIp: string | null; signerUserAgent: string | null }>>`
    SELECT "nib", "beneficiaryName", "acceptedName", "documents", "readDocumentIds", "createdAt", "completedAt", "expiresAt", "declaration", "bundleHash", "signedHash", "signerIp", "signerUserAgent"
    FROM "DeerSigningRequest" WHERE "id"=${id} AND "businessId"=${businessId} LIMIT 1`
  const row = rows[0]
  if (!row?.completedAt) return NextResponse.json({ error: 'Semnarea nu este finalizată.' }, { status: 404 })
  const lines = [
    'ELMONT S.A. - DOVADA FLUXULUI DE SEMNARE ELECTRONICA SIMPLA',
    `Dosar: ${row.nib}`, `Beneficiar din dosar: ${row.beneficiaryName}`, `Nume declarat de semnatar: ${row.acceptedName}`,
    `Link creat la (UTC): ${row.createdAt.toISOString()}`, `Acord si semnatura la (UTC): ${row.completedAt.toISOString()}`,
    `Expirarea linkului (UTC): ${row.expiresAt.toISOString()}`, '', 'Declaratia acceptata:', row.declaration || '', '',
    'Documente prezentate si declarate parcurse:',
    ...row.documents.map((doc, index) => `${index + 1}. ${doc.title} | pagini ${doc.firstPage}-${doc.firstPage + doc.pageCount - 1} | pozitii semnatura ${doc.signatures.length} | parcurs: ${row.readDocumentIds?.includes(doc.id) ? 'da' : 'nu'}`),
    '', `SHA-256 PDF prezentat: ${row.bundleHash}`, `SHA-256 PDF semnat: ${row.signedHash || ''}`,
    `Adresa IP declarata de conexiune: ${row.signerIp || ''}`, `Browser: ${row.signerUserAgent || ''}`,
    '', 'Aceste date consemneaza actiunea prin linkul privat. Ele nu certifica prin ele insele identitatea persoanei si nu reprezinta semnatura electronica calificata.',
  ]
  return new Response(`\uFEFF${lines.join('\r\n')}\r\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': `attachment; filename="DEER-${row.nib.replace(/[^A-Za-z0-9-]/g, '')}-dovada-semnare.txt"`, 'Cache-Control': 'private, no-store' } })
}
