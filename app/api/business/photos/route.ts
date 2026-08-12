import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const MAX_SIZE = 15 * 1024 * 1024 // 15MB — suficient pentru poze de calitate, fără compresie agresivă
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const businessId = (session as any).businessId
  if (!businessId) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { allowed } = rateLimit(`photo-upload:${businessId}`, 30, 60 * 60 * 1000) // 30 poze/oră/business
  if (!allowed) {
    return NextResponse.json({ error: 'Ai încărcat prea multe poze recent. Așteaptă puțin.' }, { status: 429 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const kind = formData.get('kind') as string // 'hero' | 'gallery'

  if (!file) return NextResponse.json({ error: 'Fișierul lipsește.' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Doar imagini JPG, PNG sau WebP.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Imaginea depășește 5MB.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${businessId}/${kind}-${Date.now()}.${ext}`

  try {
    const blob = await put(filename, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      storeId: process.env.BOOKBLOB_STORE_ID,
    })

    if (kind === 'hero') {
      await prisma.business.update({ where: { id: businessId }, data: { heroImageUrl: blob.url } })
    } else {
      await prisma.businessPhoto.create({ data: { businessId, url: blob.url } })
    }

    return NextResponse.json({ url: blob.url })
  } catch (err: any) {
    console.error('Eroare la upload poză:', err)
    const detail = err?.message?.includes('BLOB_READ_WRITE_TOKEN') || err?.message?.includes('token')
      ? 'Vercel Blob Storage nu e configurat — mergi în Vercel → Storage → Create Database → Blob.'
      : `Upload eșuat: ${err?.message ?? 'eroare necunoscută'}`
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
