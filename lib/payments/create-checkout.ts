import { prisma } from '@/lib/prisma'
import { createNetopiaCheckoutLink } from './netopia'
import { createEuplatescCheckoutLink } from './euplatesc'
import Stripe from 'stripe'
import { decrypt } from '@/lib/crypto'

export async function createDepositCheckoutLink(bookingId: string): Promise<string> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { business: true, service: true, customer: true },
  })
  if (!booking) throw new Error('Rezervarea nu există')

  const amount = Number(booking.service.depositAmount ?? booking.service.price ?? 0)
  if (amount <= 0) throw new Error('Serviciul nu are un avans/preț configurat')

  const { business, customer } = booking

  switch (business.paymentProcessor) {
    case 'NETOPIA':
      if (!customer.phone) throw new Error('Completează numărul de telefon înainte de generarea linkului de plată Netopia')
      return createNetopiaCheckoutLink({
        bookingId: booking.id,
        amount,
        customerName: customer.name ?? 'Client',
        customerPhone: customer.phone,
        businessSlug: business.slug,
        business,
      })

    case 'EUPLATESC':
      if (!customer.phone) throw new Error('Completează numărul de telefon înainte de generarea linkului de plată EuPlătesc')
      return createEuplatescCheckoutLink({
        bookingId: booking.id,
        amount,
        customerName: customer.name ?? 'Client',
        customerPhone: customer.phone,
        businessSlug: business.slug,
        business,
      })

    case 'STRIPE': {
      if (!business.stripeSecretKey) throw new Error('Business-ul nu are Stripe configurat')
      const stripe = new Stripe(decrypt(business.stripeSecretKey))
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'ron',
              product_data: { name: `Avans rezervare — ${booking.service.name}` },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: { bookingId: booking.id },
        success_url: `${process.env.APP_URL}/plata-confirmata`,
        cancel_url: `${process.env.APP_URL}/plata-anulata`,
      })
      if (!session.url) throw new Error('Stripe nu a returnat un link de plată')
      return session.url
    }

    default:
      throw new Error('Business-ul nu are niciun procesor de plată configurat')
  }
}
