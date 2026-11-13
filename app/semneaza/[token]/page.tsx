import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSigningRequest, requestAvailable } from '@/lib/deer-signing'
import { DeerSigner } from '@/components/forms/deer-signer'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Documente de semnat | Elmont S.A.', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default async function SigningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const row = await getSigningRequest(token)
  if (!row) notFound()
  return <DeerSigner token={token} beneficiaryName={row.beneficiaryName} nib={row.nib} documents={row.documents}
    available={Boolean(requestAvailable(row))} completed={Boolean(row.completedAt)} expiresAt={row.expiresAt.toISOString()}/>
}
