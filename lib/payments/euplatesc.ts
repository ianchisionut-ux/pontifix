// Integrare EuPlatesc.ro, folosind libraria comunitară "euplatesc" (bine documentată, cu
// tipuri TypeScript complete). La fel ca la Stripe/Netopia, fiecare business folosește
// PROPRIILE credențiale (merchantId + secretKey) — banii intră direct la business.
//
// Librăria: https://www.npmjs.com/package/euplatesc

import { EuPlatesc } from 'euplatesc'
import { decrypt } from '@/lib/crypto'

type BusinessPaymentConfig = {
  euplatescMerchantId: string | null
  euplatescSecretKey: string | null
  euplatescIsLive: boolean
}

function getEuplatescClient(business: BusinessPaymentConfig) {
  if (!business.euplatescMerchantId || !business.euplatescSecretKey) return null
  return new EuPlatesc({
    merchantId: decrypt(business.euplatescMerchantId),
    secretKey: decrypt(business.euplatescSecretKey),
    testMode: !business.euplatescIsLive,
  })
}

// Creează URL-ul de plată EuPlatesc pentru avansul unei rezervări — clientul e
// redirecționat către pagina găzduită de EuPlatesc, fără ca businessul să gestioneze
// vreodată datele cardului direct.
export function createEuplatescCheckoutLink({
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
}): string {
  const ep = getEuplatescClient(business)
  if (!ep) throw new Error('Business-ul nu are EuPlatesc configurat (Merchant ID sau Secret Key lipsă)')

  const baseUrl = process.env.APP_URL
  if (!baseUrl) throw new Error('Lipsește APP_URL din variabilele de mediu')

  const phone = customerPhone?.trim() || '0700000000'
  const [firstName, ...restName] = (customerName || 'Client').trim().split(' ')
  const lastName = restName.join(' ') || firstName

  const { paymentUrl } = ep.paymentUrl({
    amount,
    currency: 'RON',
    invoiceId: bookingId, // unic per business (fiecare are cont EuPlatesc propriu)
    orderDescription: 'Avans rezervare bookeasy.ro',
    billingFirstName: firstName,
    billingLastName: lastName,
    billingEmail: `rezervare@${businessSlug}.bookeasy.ro`,
    billingPhone: phone,
    billingAddress: '-',
    billingCity: '-',
    billingCountry: 'Romania',
    silentUrl: `${baseUrl}/api/webhooks/euplatesc/${businessSlug}`,
    successUrl: `${baseUrl}/plata-confirmata`,
    failedUrl: `${baseUrl}/plata-anulata`,
    lang: 'ro',
  })

  if (!paymentUrl) throw new Error('EuPlatesc nu a returnat un link de plată')
  return paymentUrl
}
