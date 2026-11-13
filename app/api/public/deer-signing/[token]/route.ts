import { NextRequest, NextResponse } from 'next/server'
import { get, put } from '@vercel/blob'
import { degrees, PDFDocument } from 'pdf-lib'
import { prisma } from '@/lib/prisma'
import { ensureBeneficiarySignatureStorage } from '@/lib/beneficiary-signature'
import { getSigningRequest, requestAvailable, sha256 } from '@/lib/deer-signing'
import { SIGNING_DECLARATION } from '@/lib/deer-signing-shared'
import { BENEFICIARY_SIGNED_KEY } from '@/components/forms/form-stamps'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const row = await getSigningRequest(token)
  if (!row || !requestAvailable(row)) return NextResponse.json({ error: 'Linkul a expirat sau a fost anulat.' }, { status: 404 })
  if (row.completedAt) return NextResponse.json({ error: 'Documentele au fost deja semnate.' }, { status: 409 })
  const body = await request.json().catch(() => null)
  const acceptedName = typeof body?.acceptedName === 'string' ? body.acceptedName.trim().replace(/\s+/g, ' ') : ''
  const readIds = Array.isArray(body?.readDocumentIds) ? body.readDocumentIds : []
  const imageUrl = typeof body?.image === 'string' ? body.image : ''
  if (acceptedName.length < 5 || acceptedName.length > 120 || body?.agreement !== true || body?.identityConfirmed !== true ||
    readIds.length !== row.documents.length || new Set(readIds).size !== readIds.length || !row.documents.every((item) => readIds.includes(item.id))) {
    return NextResponse.json({ error: 'Verifică documentele și confirmările înainte de semnare.' }, { status: 400 })
  }
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(imageUrl) || imageUrl.length > 700_000) return NextResponse.json({ error: 'Semnătura PNG este invalidă.' }, { status: 400 })
  const image = Buffer.from(imageUrl.slice('data:image/png;base64,'.length), 'base64')
  if (image.length < 150 || image.length > 500_000 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return NextResponse.json({ error: 'Semnătura PNG este invalidă.' }, { status: 400 })
  try {
    const source = await get(row.bundlePathname, { access: 'private' })
    if (!source?.stream) throw new Error('PDF-ul original nu mai este disponibil.')
    const sourceBytes = new Uint8Array(await new Response(source.stream).arrayBuffer())
    if (sha256(sourceBytes) !== row.bundleHash) throw new Error('Documentele s-au modificat. Cere un link nou.')
    const pdf = await PDFDocument.load(sourceBytes)
    const signature = await pdf.embedPng(image)
    for (const document of row.documents) for (const mark of document.signatures) {
      const page = pdf.getPage(mark.page - 1)
      if (!page) throw new Error('Poziția semnăturii este invalidă.')
      const width = page.getWidth() * mark.width
      const height = page.getHeight() * mark.height
      page.drawImage(signature, {
        x: page.getWidth() * mark.x, y: page.getHeight() * (1 - mark.y - mark.height),
        width, height, rotate: degrees(-mark.rotation),
      })
    }
    pdf.setTitle(`Documente DEER semnate - ${row.nib}`)
    pdf.setSubject('Semnătură electronică simplă desenată de beneficiar')
    pdf.setModificationDate(new Date())
    const signedBytes = await pdf.save()
    const signedHash = sha256(signedBytes)
    const signedBlob = await put(`formulare/deer-signing/${row.connectionId}/${row.id}-${randomUUID()}-signed.pdf`, Buffer.from(signedBytes), { access: 'private', contentType: 'application/pdf' })
    const signedPathname = signedBlob.pathname
    const signerIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 100) || null
    const signerUserAgent = request.headers.get('user-agent')?.slice(0, 400) || null
    await ensureBeneficiarySignatureStorage()
    const signedIds = row.documents.filter((item) => item.signatures.length).map((item) => item.id)
    await prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`UPDATE "DeerSigningRequest" SET "signedPathname"=${signedPathname}, "signedHash"=${signedHash},
        "completedAt"=CURRENT_TIMESTAMP, "acceptedName"=${acceptedName}, "declaration"=${SIGNING_DECLARATION},
        "readDocumentIds"=${JSON.stringify(readIds)}::jsonb, "signatureImage"=${image}, "signerIp"=${signerIp}, "signerUserAgent"=${signerUserAgent}
        WHERE "id"=${row.id} AND "completedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP`
      if (updated !== 1) throw new Error('Acest link a fost deja folosit sau anulat.')
      await tx.$executeRaw`INSERT INTO "BeneficiarySignature" ("businessId", "connectionId", "image", "capturedByEmail")
        VALUES (${row.businessId}, ${row.connectionId}, ${image}, 'link beneficiar')
        ON CONFLICT ("businessId", "connectionId") DO UPDATE SET "image"=EXCLUDED."image", "capturedByEmail"=EXCLUDED."capturedByEmail",
          "consentConfirmedAt"=CURRENT_TIMESTAMP, "signedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP`
      for (const templateId of signedIds) {
        const count = await tx.$executeRaw`UPDATE "FormSubmission" SET "values"=jsonb_set(COALESCE("values", '{}'::jsonb), ${`{${BENEFICIARY_SIGNED_KEY}}`}::text[], '"yes"'::jsonb), "updatedAt"=CURRENT_TIMESTAMP
          WHERE "businessId"=${row.businessId} AND "sourceId"=${row.connectionId} AND "formTemplateId"=${templateId}`
        if (!count) await tx.$executeRaw`INSERT INTO "FormSubmission" ("id", "businessId", "formTemplateId", "title", "sourceType", "sourceId", "values", "fieldSchema", "stampSchema")
          SELECT ${randomUUID()}, ${row.businessId}, "id", "title", 'CONNECTION', ${row.connectionId}, ${JSON.stringify({ [BENEFICIARY_SIGNED_KEY]: 'yes' })}::jsonb, "fieldSchema", '[]'::jsonb
          FROM "FormTemplate" WHERE "id"=${templateId} AND "businessId"=${row.businessId}`
      }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Semnarea nu a reușit.' }, { status: 500 })
  }
}
