import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncFutureBookings } from '@/lib/google-calendar'

async function owned(practitionerId: string, businessId: string) {
  return prisma.googleCalendarConnection.findFirst({ where: { practitionerId, businessId } })
}
export async function PATCH(req: NextRequest) {
  const session = await auth(); const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json(); const connection = await owned(body.practitionerId, businessId)
  if (!connection) return NextResponse.json({ error: 'Conexiunea nu există.' }, { status: 404 })
  await prisma.googleCalendarConnection.update({ where: { id: connection.id }, data: { syncEnabled: body.syncEnabled === true, includeCustomerDetails: body.includeCustomerDetails === true } })
  return NextResponse.json({ success: true })
}
export async function POST(req: NextRequest) {
  const session = await auth(); const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { practitionerId } = await req.json(); if (!(await owned(practitionerId, businessId))) return NextResponse.json({ error: 'Conexiunea nu există.' }, { status: 404 })
  return NextResponse.json({ success: true, count: await syncFutureBookings(practitionerId) })
}
export async function DELETE(req: NextRequest) {
  const session = await auth(); const businessId = (session as any)?.businessId
  if (!businessId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const practitionerId = req.nextUrl.searchParams.get('practitionerId') ?? ''; const connection = await owned(practitionerId, businessId)
  if (!connection) return NextResponse.json({ error: 'Conexiunea nu există.' }, { status: 404 })
  await prisma.googleCalendarConnection.delete({ where: { id: connection.id } })
  return NextResponse.json({ success: true })
}
