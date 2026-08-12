import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

let stripeClient: Stripe | null = null
function getStripe() {
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)
  return stripeClient
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { planId } = await req.json()
  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  const businessId = (session as any).businessId
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!plan || !business) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let stripeCustomerId = business.stripeCustomerId
  if (!stripeCustomerId) {
    const customer = await getStripe().customers.create({
      email: (session as any).user?.email,
      name: business.name,
      metadata: { businessId: business.id },
    })
    stripeCustomerId = customer.id
    await prisma.business.update({ where: { id: business.id }, data: { stripeCustomerId } })
  }

  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 30,
      metadata: { businessId: business.id, planId: plan.id },
    },
    success_url: `${process.env.APP_URL}/dashboard?subscribed=true`,
    cancel_url: `${process.env.APP_URL}/onboarding/plan`,
  })

  return NextResponse.json({ checkoutUrl: checkoutSession.url })
}
