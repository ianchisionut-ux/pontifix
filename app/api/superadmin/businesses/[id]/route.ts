import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.enum(['SALON', 'EVENT_VENUE', 'HOTEL', 'PENSIUNE', 'CLINICA']).optional(),
  planName: z.string().nullable().optional(),
  billingStatus: z.enum(['GRATUIT', 'NEPLATIT', 'PLATIT', 'RESTANT']).optional(),
  billingNote: z.string().nullable().optional(),
  publicListed: z.boolean().optional(),
  accountActive: z.boolean().optional(),
  teamSize: z.number().min(1).max(200).optional(),
})

async function requireSuperAdmin() {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return null
  return session
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await prisma.business.update({ where: { id }, data: parsed.data })

  return NextResponse.json({ success: true })
}

// Ștergere definitivă — curăță manual toate relațiile, pentru că nu avem
// onDelete: Cascade setat în schema (evităm ștergeri accidentale în lanț la alte operații)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: businessId } = await params

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business-ul nu există.' }, { status: 404 })

  const users = await prisma.user.findMany({ where: { businessId } })
  const userIds = users.map((u) => u.id)

  try {
    await prisma.$transaction(
      async (tx) => {
        // token-urile de parolă trebuie șterse ÎNAINTE de useri, altfel constrângerea
        // de cheie străină blochează întreaga ștergere
        await tx.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } })
        await tx.missedMessageAlert.deleteMany({ where: { businessId } })
        await tx.review.deleteMany({ where: { businessId } })
        await tx.blockedSlot.deleteMany({ where: { businessId } })
        await tx.businessPhoto.deleteMany({ where: { businessId } })
        await tx.conversation.deleteMany({ where: { businessId } })
        await tx.booking.deleteMany({ where: { businessId } })
        await tx.servicePractitioner.deleteMany({ where: { practitioner: { businessId } } })
        await tx.practitionerWorkingHours.deleteMany({ where: { practitioner: { businessId } } })
        await tx.practitioner.deleteMany({ where: { businessId } })
        await tx.patientDocument.deleteMany({ where: { businessId } })
        await tx.medicalLetter.deleteMany({ where: { businessId } })
        await tx.patientMedicalRecord.deleteMany({ where: { customer: { businessId } } })
        await tx.customer.deleteMany({ where: { businessId } })
        await tx.service.deleteMany({ where: { businessId } })
        await tx.resource.deleteMany({ where: { businessId } })
        await tx.staff.deleteMany({ where: { businessId } })
        await tx.workingHours.deleteMany({ where: { businessId } })
        await tx.channel.deleteMany({ where: { businessId } })
        await tx.subscription.deleteMany({ where: { businessId } })
        await tx.user.deleteMany({ where: { businessId } })
        await tx.business.delete({ where: { id: businessId } })
      },
      { timeout: 20000 } // implicit Prisma e 5s — insuficient pentru businessuri cu multe rezervări/recenzii
    )
  } catch (err: any) {
    console.error('Eroare la ștergerea business-ului:', err)
    return NextResponse.json({ error: `Ștergerea a eșuat: ${err.message ?? 'eroare necunoscută'}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
