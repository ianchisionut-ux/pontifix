import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { getSigningRequest, requestAvailable } from '@/lib/deer-signing'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const row = await getSigningRequest(token)
  if (!row || !requestAvailable(row)) return NextResponse.json({ error: 'Link indisponibil sau expirat.' }, { status: 404 })
  const signed = request.nextUrl.searchParams.get('version') === 'signed'
  if (signed && (!row.completedAt || !row.signedPathname)) return NextResponse.json({ error: 'Documentele nu au fost semnate.' }, { status: 404 })
  const result = await get(signed ? row.signedPathname! : row.bundlePathname, { access: 'private' })
  if (!result?.stream) return NextResponse.json({ error: 'PDF indisponibil.' }, { status: 404 })
  const filename = `DEER-${row.nib.replace(/[^A-Za-z0-9-]/g, '')}${signed ? '-semnat' : '-de-analizat'}.pdf`
  return new Response(result.stream, { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${request.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="${filename}"`,
    'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
  } })
}
