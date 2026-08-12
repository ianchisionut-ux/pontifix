import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Step3Form from './step3-form'

export default async function OnboardingStep3() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) redirect('/login')

  return <Step3Form category={business.category} />
}
