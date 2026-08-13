import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const ip = getClientIp(request)
  if (!rateLimit(`quote-upload:${ip}`, 6, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: 'Prea multe încărcări. Încearcă din nou mai târziu.' }, { status: 429 })
  }

  try {
    const body = await request.json() as HandleUploadBody
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('cereri-oferta/')) throw new Error('Cale de încărcare invalidă.')
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Încărcarea ATR a eșuat.' }, { status: 400 })
  }
}
