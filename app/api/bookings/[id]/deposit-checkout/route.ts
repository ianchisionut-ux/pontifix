import { NextRequest, NextResponse } from 'next/server'
import { createDepositCheckoutLink } from '@/lib/payments/create-checkout'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const url = await createDepositCheckoutLink(id)
    return NextResponse.redirect(url)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Eroare la generarea link-ului de plată' }, { status: 400 })
  }
}
