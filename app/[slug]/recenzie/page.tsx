import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PublicHeader } from '@/components/ui/public-header'
import { BackLink } from '@/components/ui/back-link'
import ReviewForm from './review-form'

export default async function RecenziePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const business = await prisma.business.findUnique({ where: { slug } })
  if (!business || !business.publicListed) notFound()
  if (business.category === 'HOTEL' || business.category === 'PENSIUNE') notFound()

  return (
    <main className="min-h-screen bg-[var(--surface-muted)]">
      <PublicHeader />
      <div className="max-w-md mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-4">
          <BackLink href={`/${slug}`} label={`Înapoi la ${business.name}`} />
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold mb-1">Lasă o recenzie</h1>
        <p className="text-sm text-gray-500 mb-6">pentru {business.name}</p>

        <ReviewForm slug={slug} />
      </div>
    </main>
  )
}
