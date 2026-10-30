import { NextResponse } from 'next/server'
import { issueSignedToken } from '@vercel/blob'
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureTenderStorage } from '@/lib/tenders'

export async function POST(request: Request) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!['OWNER', 'SUPER_ADMIN'].includes((session as any)?.role)) return NextResponse.json({ error: 'Nu ai permisiunea de încărcare.' }, { status: 403 })
  await ensureTenderStorage()

  try {
    const body = await request.json() as HandleUploadPresignedBody
    const response = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async pathname => {
        const parts = pathname.split('/')
        if (parts.length !== 5 || parts[0] !== 'tenders' || parts[2] !== 'instructions' || parts[4] !== 'instructions.pdf' || !/^[0-9a-f-]{36}$/i.test(parts[1]) || !/^[0-9a-f-]{36}$/i.test(parts[3])) throw new Error('Cale de încărcare invalidă.')
        const found = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Tender" WHERE "id"=${parts[1]} AND "businessId"=${businessId}`
        if (!found.length) throw new Error('Licitația nu a fost găsită.')
        const validUntil = Date.now() + 20 * 60 * 1000
        const token = await issueSignedToken({ pathname, operations: ['put'], allowedContentTypes: ['application/pdf'], maximumSizeInBytes: 20 * 1024 * 1024, validUntil })
        return { token, urlOptions: { allowedContentTypes: ['application/pdf'], maximumSizeInBytes: 20 * 1024 * 1024, validUntil } }
      },
    })
    return NextResponse.json(response)
  } catch (error) {
    console.error('Tender PDF upload failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Încărcarea a eșuat.' }, { status: 400 })
  }
}
