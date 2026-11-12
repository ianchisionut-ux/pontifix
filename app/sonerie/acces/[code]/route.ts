import { NextRequest, NextResponse } from 'next/server'
import { roleForCode, setSonerieSession } from '@/lib/sonerie'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const role = code.length <= 128 ? roleForCode(code) : null
  if (!role) return new NextResponse('Link privat invalid.', { status: 404, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
  await setSonerieSession(role)
  const response = NextResponse.redirect(new URL('/sonerie', request.url))
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
