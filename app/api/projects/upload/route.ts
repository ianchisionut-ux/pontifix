import { NextResponse } from 'next/server'
import { issueSignedToken } from '@vercel/blob'
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client'
import { auth } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  if ((session as any)?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Doar Super Adminul poate încărca documente de proiect.' }, { status: 403 })
  }

  try {
    const body = await request.json() as HandleUploadPresignedBody
    const response = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        if (!pathname.startsWith('projects/')) throw new Error('Cale de încărcare invalidă.')
        const validUntil = Date.now() + 20 * 60 * 1000
        const token = await issueSignedToken({
          pathname,
          operations: ['put'],
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 20 * 1024 * 1024,
          validUntil,
        })
        return {
          token,
          urlOptions: {
            allowedContentTypes: ['application/pdf'],
            maximumSizeInBytes: 20 * 1024 * 1024,
            validUntil,
          },
        }
      },
    })
    return NextResponse.json(response)
  } catch (error) {
    console.error('Project document upload failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Încărcarea a eșuat.' }, { status: 400 })
  }
}
