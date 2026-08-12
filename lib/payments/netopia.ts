// Integrare Netopia Payments (API v2), folosind SDK-ul oficial "netopia-payment2".
// Ca și la Stripe, fiecare business folosește PROPRIILE credențiale (apiKey + posSignature,
// din contul lui Netopia) — banii intră direct la business, nu la bookeasy.ro.
//
// Documentație oficială: https://doc.netopia-payments.com/
// SDK: https://www.npmjs.com/package/netopia-payment2

import { Netopia } from 'netopia-payment2'
import { decrypt } from '@/lib/crypto'

type BusinessPaymentConfig = {
  netopiaApiKey: string | null
  netopiaPosSignature: string | null
  netopiaIsLive: boolean
}

function getNetopiaClient(business: BusinessPaymentConfig) {
  if (!business.netopiaApiKey || !business.netopiaPosSignature) return null
  return new Netopia({
    apiKey: decrypt(business.netopiaApiKey),
    posSignature: decrypt(business.netopiaPosSignature),
    isLive: business.netopiaIsLive,
  })
}

// Creează un link de plată Netopia pentru avansul unei rezervări (Booking) și
// returnează URL-ul către care redirecționăm clientul — pagina de plată găzduită de
// Netopia (la fel ca Stripe Checkout), businessul nu gestionează niciodată datele cardului.
export async function createNetopiaCheckoutLink({
  bookingId,
  amount,
  customerName,
  customerPhone,
  businessSlug,
  business,
}: {
  bookingId: string
  amount: number
  customerName: string
  customerPhone: string
  businessSlug: string
  business: BusinessPaymentConfig
}): Promise<string> {
  const netopia = getNetopiaClient(business)
  if (!netopia) throw new Error('Business-ul nu are Netopia configurat (API Key sau POS Signature lipsă)')

  const baseUrl = process.env.APP_URL
  if (!baseUrl) throw new Error('Lipsește APP_URL din variabilele de mediu')

  const configData = {
    emailTemplate: '',
    emailSubject: '',
    notifyUrl: `${baseUrl}/api/webhooks/netopia/${businessSlug}`,
    redirectUrl: `${baseUrl}/plata-confirmata`,
    cancelUrl: `${baseUrl}/plata-anulata`,
    language: 'ro',
  }

  const paymentData = {
    options: { installments: 0, bonus: 0, split: [] as { posID: number; amount: number }[] },
    instrument: { type: 'card' }, // fără date de card — clientul le introduce pe pagina Netopia
    data: {},
  }

  const phone = customerPhone?.trim() || '0700000000'
  const [firstName, ...restName] = (customerName || 'Client').trim().split(' ')
  const lastName = restName.join(' ') || firstName

  const orderData = {
    orderID: bookingId, // unic per business (fiecare are cont Netopia propriu)
    description: `Avans rezervare bookeasy.ro`,
    amount,
    currency: 'RON',
    dateTime: new Date().toISOString().slice(0, 19),
    billing: {
      email: `rezervare@${businessSlug}.bookeasy.ro`,
      phone,
      firstName,
      lastName,
      city: '-',
      country: 642, // România, cod ISO 3166-1 numeric
      countryName: 'Romania',
      state: '-',
      postalCode: '-',
      details: '',
    },
  }

  const response = await netopia.createOrder(configData, paymentData as any, orderData as any)
  const paymentUrl = (response as any)?.data?.payment?.paymentURL
  if (!paymentUrl) {
    const errMsg = (response as any)?.data?.error?.message ?? 'Răspuns neașteptat de la Netopia'
    throw new Error(`Netopia nu a returnat un link de plată: ${errMsg}`)
  }
  return paymentUrl
}
