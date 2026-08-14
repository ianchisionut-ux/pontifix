import { NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureProjectAuthorizationStorage } from '@/lib/ensure-project-authorization-storage'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })

  await ensureProjectAuthorizationStorage()
  const { id } = await params
  const project = await prisma.project.findFirst({
    where: { id, businessId },
    select: { authorizationDocumentUrl: true, authorizationDocumentName: true },
  })
  if (!project?.authorizationDocumentUrl) return NextResponse.json({ error: 'Autorizația nu este încărcată.' }, { status: 404 })

  const result = await get(project.authorizationDocumentUrl, { access: 'private' })
  if (!result?.stream) return NextResponse.json({ error: 'Fișier indisponibil.' }, { status: 404 })

  const filename = (project.authorizationDocumentName || 'autorizatie-de-construire.pdf').replace(/"/g, '')
  const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline'
  const headers = new Headers()
  headers.set('Content-Type', 'application/pdf')
  headers.set('Content-Disposition', `${disposition}; filename="${filename}"`)
  return new Response(result.stream, { headers })
}
