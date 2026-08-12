import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import RequestActions from './request-actions'
import { Mail, Phone } from 'lucide-react'

const CATEGORY_LABEL: Record<string, string> = {
  SALON: 'Salon',
  EVENT_VENUE: 'Spații evenimente',
  HOTEL: 'Hotel',
  PENSIUNE: 'Pensiune',
  CLINICA: 'Clinică',
}

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Nouă',
  CONTACTED: 'Contactată',
  CONVERTED: 'Convertită',
  DISMISSED: 'Respinsă',
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  NEW: 'warning',
  CONTACTED: 'neutral',
  CONVERTED: 'success',
  DISMISSED: 'danger',
}

export default async function AccessRequestsPage() {
  const requests = await prisma.accessRequest.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-semibold mb-1">Cereri de acces</h1>
      <p className="text-sm text-gray-500 mb-6">{requests.length} cereri primite din formularul de pe homepage</p>

      <div className="flex flex-col gap-3">
        {requests.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-medium">
                  {r.businessName} <span className="text-gray-400 font-normal">· {r.name}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {r.category ? CATEGORY_LABEL[r.category] : '—'} ·{' '}
                  {r.createdAt.toLocaleDateString('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' })}
                </p>
              </div>
              <Pill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill>
            </div>
            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1 flex-wrap">
              <Mail size={13} /> <a href={`mailto:${r.email}`} className="text-[var(--accent)]">{r.email}</a> ·
              <Phone size={13} /> <a href={`tel:${r.phone}`} className="text-[var(--accent)]">{r.phone}</a>
            </p>
            {r.message && <p className="text-sm text-gray-500 italic mb-2">"{r.message}"</p>}
            <RequestActions id={r.id} status={r.status} />
          </Card>
        ))}
        {requests.length === 0 && <p className="text-sm text-gray-500">Nicio cerere încă.</p>}
      </div>
    </div>
  )
}
