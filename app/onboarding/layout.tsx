import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const businessId = (session as any).businessId
  const business = businessId ? await prisma.business.findUnique({ where: { id: businessId } }) : null

  if (business?.onboardingDone) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-[var(--surface-muted)] flex flex-col items-center px-6 py-10">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={28} height={28} />
        <span className="font-semibold">bookeasy.ro</span>
      </Link>
      <div className="w-full max-w-lg">{children}</div>
    </main>
  )
}
