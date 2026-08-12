import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getPractitionerDaySlotsWithStatus } from '@/lib/availability'

export async function GET(req: NextRequest) {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const serviceId = req.nextUrl.searchParams.get('serviceId')
  const practitionerId = req.nextUrl.searchParams.get('practitionerId')
  const dateParam = req.nextUrl.searchParams.get('date')
  if (!serviceId || !practitionerId || !dateParam) {
    return NextResponse.json({ error: 'Parametri lipsă' }, { status: 400 })
  }

  const date = new Date(`${dateParam}T00:00:00Z`)
  const allSlots = await getPractitionerDaySlotsWithStatus(businessId, serviceId, practitionerId, date, true)

  return NextResponse.json({ allSlots })
}
