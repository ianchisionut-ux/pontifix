import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Step1Form from './step1-form'

export default async function OnboardingStep1Page() {
  const session = await auth()
  const businessId = (session as any)?.businessId
  if (!businessId) redirect('/login')

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { category: true } })
  if (!business) redirect('/login')

  return <Step1Form currentCategory={business.category} />
}
