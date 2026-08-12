import { redirect } from 'next/navigation'

// pasul de echipă a fost eliminat (bookeasy funcționează cu o singură gestiune per salon) —
// oricine ajunge aici (link vechi sau onboarding neterminat) sare direct la pasul final
export default function Step4Redirect() {
  redirect('/onboarding/step-5')
}
