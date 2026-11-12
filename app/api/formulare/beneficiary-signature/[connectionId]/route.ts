import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureBeneficiarySignatureStorage, getBeneficiarySignature } from '@/lib/beneficiary-signature'

async function access(connectionId: string) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return null
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "ConnectionCase" WHERE "id"=${connectionId} AND "businessId"=${businessId} LIMIT 1`
  return rows[0] ? { businessId, role: (session as any)?.role as string, email: session?.user?.email || null } : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params
  const user = await access(connectionId)
  if (!user) return NextResponse.json({ error: 'Branșament indisponibil.' }, { status: 404 })
  const signature = await getBeneficiarySignature(user.businessId, connectionId)
  if (!signature) return NextResponse.json({ error: 'Beneficiarul nu a semnat încă.' }, { status: 404 })
  return new Response(new Uint8Array(signature.image), { headers: {
    'Content-Type': 'image/png', 'Cache-Control': 'private, no-store',
    'X-Signed-At': signature.signedAt.toISOString(),
  } })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params
  const user = await access(connectionId)
  if (!user) return NextResponse.json({ error: 'Branșament indisponibil.' }, { status: 404 })
  if (user.role === 'STAFF') return NextResponse.json({ error: 'Contul nu poate salva semnături.' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (body?.consentConfirmed !== true) return NextResponse.json({ error: 'Este necesară confirmarea acordului beneficiarului.' }, { status: 400 })
  const dataUrl = typeof body?.image === 'string' ? body.image : ''
  if (!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(dataUrl) || dataUrl.length > 700_000) {
    return NextResponse.json({ error: 'Semnătura trebuie să fie o imagine PNG validă.' }, { status: 400 })
  }
  const image = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64')
  if (image.length < 100 || image.length > 500_000 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    return NextResponse.json({ error: 'Semnătura PNG este invalidă.' }, { status: 400 })
  }
  await ensureBeneficiarySignatureStorage()
  await prisma.$executeRaw`
    INSERT INTO "BeneficiarySignature" ("businessId", "connectionId", "image", "capturedByEmail")
    VALUES (${user.businessId}, ${connectionId}, ${image}, ${user.email})
    ON CONFLICT ("businessId", "connectionId") DO UPDATE SET
      "image"=EXCLUDED."image", "capturedByEmail"=EXCLUDED."capturedByEmail", "consentConfirmedAt"=CURRENT_TIMESTAMP,
      "signedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP`
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await params
  const user = await access(connectionId)
  if (!user) return NextResponse.json({ error: 'Branșament indisponibil.' }, { status: 404 })
  if (user.role === 'STAFF') return NextResponse.json({ error: 'Contul nu poate șterge semnături.' }, { status: 403 })
  await ensureBeneficiarySignatureStorage()
  await prisma.$executeRaw`DELETE FROM "BeneficiarySignature" WHERE "businessId"=${user.businessId} AND "connectionId"=${connectionId}`
  return NextResponse.json({ success: true })
}
