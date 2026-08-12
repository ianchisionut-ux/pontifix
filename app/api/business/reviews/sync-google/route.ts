import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { syncGoogleReviews } from '@/lib/google-reviews'

export async function POST() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const result = await syncGoogleReviews(businessId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ synced: result.synced })
}
