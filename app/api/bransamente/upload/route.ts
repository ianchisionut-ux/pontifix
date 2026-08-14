import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getConnectionAccess } from '@/lib/connection-access'

export async function POST(request: Request) {
  const access = await getConnectionAccess()
  if (!access) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if (!access.canManage) return NextResponse.json({ error: 'Doar Super Adminul poate încărca ATR-uri.' }, { status: 403 })
  try {
    const body = await request.json() as HandleUploadBody
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('bransamente/')) throw new Error('Cale de încărcare invalidă.')
        return { allowedContentTypes: ['application/pdf'], maximumSizeInBytes: 20 * 1024 * 1024, addRandomSuffix: true }
      },
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Încărcarea ATR a eșuat.' }, { status: 400 })
  }
}
