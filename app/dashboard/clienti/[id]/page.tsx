import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import CustomerEditForm from './customer-edit-form'
import PatientDetailTabs from './patient-detail-tabs'
import { Card } from '@/components/ui/card'
import { Pill } from '@/components/ui/input'
import { BackLink } from '@/components/ui/back-link'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const businessId = (session as any)?.businessId

  if (!businessId) notFound()

  // Filtrăm clientul direct după businessId. Verificarea doar a autentificării nu este
  // suficientă: un ID cunoscut nu trebuie să poată expune datele altui business.
  const [customer, business] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, businessId },
      include: { bookings: { include: { service: true, practitioner: true }, orderBy: { startAt: 'desc' } } },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { category: true } }),
  ])

  if (!customer) notFound()

  const [medicalRecord, documents, letters] = await Promise.all([
    prisma.patientMedicalRecord.findUnique({ where: { customerId: customer.id } }),
    prisma.patientDocument.findMany({ where: { customerId: customer.id, businessId }, orderBy: { uploadedAt: 'desc' } }),
    prisma.medicalLetter.findMany({ where: { customerId: customer.id, businessId }, orderBy: { createdAt: 'desc' } }),
  ])
  const isClinic = business?.category === 'CLINICA'
  const patientName = customer.name ?? customer.phone ?? 'Fără nume'

  const simpleInitial = {
    name: customer.name ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    notes: customer.notes ?? '',
    dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.toISOString().slice(0, 10) : '',
    allergies: customer.allergies ?? '',
    medicalNotes: customer.medicalNotes ?? '',
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="mb-4 screen-only">
        <BackLink href="/dashboard/clienti" label={`Înapoi la ${isClinic ? 'pacienți' : 'clienți'}`} />
      </div>

      <h1 className="text-2xl font-semibold mb-6 screen-only">{customer.name ?? 'Fără nume'}</h1>

      {isClinic ? (
        <PatientDetailTabs
          customerId={customer.id}
          patientName={patientName}
          simpleInitial={simpleInitial}
          medicalRecordInitial={medicalRecord}
          documents={documents.map((d) => ({
            id: d.id,
            url: `/api/business/patients/${customer.id}/documents/${d.id}`,
            filename: d.filename,
            uploadedAt: d.uploadedAt.toISOString(),
          }))}
          letters={letters.map((l) => ({ ...l, id: l.id }))}
        />
      ) : (
        <Card className="mb-8">
          <h2 className="font-medium mb-4">Date {isClinic ? 'pacient' : 'client'}</h2>
          <CustomerEditForm customerId={customer.id} isClinic={false} initial={simpleInitial} />
        </Card>
      )}

      <div className="screen-only">
        <h2 className="text-lg font-medium mb-3 mt-8">Istoric {isClinic ? 'consultații' : 'rezervări'}</h2>
        <div className="flex flex-col gap-2">
          {customer.bookings.map((b) => (
            <Card key={b.id} className="flex items-center justify-between py-3">
              <span className="font-medium">
                {b.service.name}
                {b.practitioner ? ` · ${b.practitioner.name}` : ''}
              </span>
              <span className="text-gray-500 text-sm">{b.startAt.toLocaleString('ro-RO', { hour12: false, timeZone: 'Europe/Bucharest' })}</span>
              <Pill tone={b.status === 'CONFIRMED' ? 'success' : b.status === 'CANCELLED' ? 'danger' : 'neutral'}>
                {b.status}
              </Pill>
            </Card>
          ))}
          {customer.bookings.length === 0 && <p className="text-sm text-gray-500">Niciun istoric încă.</p>}
        </div>
      </div>
    </div>
  )
}
