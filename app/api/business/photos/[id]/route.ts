import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const blobOptions = { token: process.env.BLOB_READ_WRITE_TOKEN, storeId: process.env.BOOKBLOB_STORE_ID }

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  const { id } = await params

  if (id === 'hero') {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (business?.heroImageUrl) {
      await del(business.heroImageUrl, blobOptions).catch(() => {}) // dacă fișierul nu mai există fizic, ignorăm
      await prisma.business.update({ where: { id: businessId }, data: { heroImageUrl: null } })
    }
    return NextResponse.json({ success: true })
  }

  const photo = await prisma.businessPhoto.findUnique({ where: { id } })
  if (!photo || photo.businessId !== businessId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  await del(photo.url, blobOptions).catch(() => {})
  await prisma.businessPhoto.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
