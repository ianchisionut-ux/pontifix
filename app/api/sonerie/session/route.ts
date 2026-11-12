import { NextResponse } from 'next/server'
import { getSonerieRole } from '@/lib/sonerie'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ role: await getSonerieRole() }, { headers: { 'Cache-Control': 'no-store' } })
}
