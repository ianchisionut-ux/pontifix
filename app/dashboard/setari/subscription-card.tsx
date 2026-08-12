import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'

const STATUS_LABEL: Record<string, string> = {
  GRATUIT: 'Gratuit (cont demo)',
  NEPLATIT: 'Neplătit',
  PLATIT: 'Plătit',
  RESTANT: 'Restant',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  GRATUIT: 'neutral',
  NEPLATIT: 'warning',
  PLATIT: 'success',
  RESTANT: 'danger',
}

export function SubscriptionCard({ planName, billingStatus }: { planName: string | null; billingStatus: string }) {
  return (
    <Card className="mb-5 break-inside-avoid">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Abonament</h2>
        <Pill tone={STATUS_TONE[billingStatus] ?? 'neutral'}>{STATUS_LABEL[billingStatus] ?? billingStatus}</Pill>
      </div>
      <p className="text-sm text-gray-500">
        {planName ? `Plan: ${planName}` : 'Niciun plan asociat momentan.'}
      </p>
      <p className="text-xs text-gray-400 mt-2">
        Plata online recurentă (card, automat lunar) va fi disponibilă în curând. Până atunci, contactează-ne
        pentru detalii de facturare.
      </p>
    </Card>
  )
}
