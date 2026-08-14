import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureFormStorage } from '@/lib/ensure-form-storage'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  await ensureFormStorage(businessId)
  const { id } = await params
  const rows = await prisma.$queryRaw<Array<{ documentPathname: string; documentName: string }>>`SELECT "documentPathname", "documentName" FROM "FormTemplate" WHERE "id"=${id} AND "businessId"=${businessId} LIMIT 1`
  const form = rows[0]
  if (!form) return NextResponse.json({ error: 'Formular inexistent.' }, { status: 404 })

  let body: BodyInit
  if (form.documentPathname.startsWith('asset:')) {
    const filename = path.basename(form.documentPathname.slice(6))
    body = await fs.readFile(path.join(process.cwd(), 'assets', 'formulare', filename))
  } else {
    const result = await get(form.documentPathname, { access: 'private' })
    if (!result?.stream) return NextResponse.json({ error: 'Fișier indisponibil.' }, { status: 404 })
    body = result.stream
  }
  const filename = form.documentName.replace(/"/g, '')
  const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline'
  return new Response(body, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${disposition}; filename="${filename}"`, 'Cache-Control': 'private, no-store' } })
}
