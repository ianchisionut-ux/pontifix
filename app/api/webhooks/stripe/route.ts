import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

let stripeClient: Stripe | null = null
function getStripe() {
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)
  return stripeClient
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const subscription = await getStripe().subscriptions.retrieve(session.subscription as string)
      await upsertSubscription(subscription)
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await upsertSubscription(event.data.object as Stripe.Subscription)
      break
    }
    case 'invoice.payment_failed': {
      // TODO: notifică owner-ul, eventual suspendă botul dacă rămâne UNPAID mai multe zile
      break
    }
  }

  return NextResponse.json({ received: true })
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const businessId = sub.metadata.businessId
  const planId = sub.metadata.planId
  if (!businessId || !planId) return

  await prisma.subscription.upsert({
    where: { businessId },
    create: {
      businessId,
      planId,
      stripeCustomerId: sub.customer as string,
      stripeSubscriptionId: sub.id,
      status: mapStripeStatus(sub.status),
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    },
    update: {
      status: mapStripeStatus(sub.status),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  })
}

function mapStripeStatus(stripeStatus: string) {
  const map: Record<string, 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID'> = {
    trialing: 'TRIALING',
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
  }
  return map[stripeStatus] ?? 'CANCELED'
}
