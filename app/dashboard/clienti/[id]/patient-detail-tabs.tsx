'use client'

import { useState } from 'react'
import PatientRecordForm from './patient-record-form'
import PatientDocuments from './patient-documents'
import MedicalLetterForm from './medical-letter-form'

export default function PatientDetailTabs({
  customerId,
  patientName,
  simpleInitial,
  medicalRecordInitial,
  documents,
  letters,
}: {
  customerId: string
  patientName: string
  simpleInitial: { name: string; phone: string; email: string; notes: string; dateOfBirth: string; allergies: string; medicalNotes: string }
  medicalRecordInitial: any
  documents: { id: string; url: string; filename: string; uploadedAt: string }[]
  letters: Record<string, any>[]
}) {
  const [tab, setTab] = useState<'RECORD' | 'LETTER' | 'DOCS'>('RECORD')

  const tabs = [
    { id: 'RECORD' as const, label: 'Fișă pacient' },
    { id: 'LETTER' as const, label: `Scrisoare medicală${letters.length > 0 ? ` (${letters.length})` : ''}` },
    { id: 'DOCS' as const, label: `Documente${documents.length > 0 ? ` (${documents.length})` : ''}` },
  ]

  return (
    <div>
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1 screen-only">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition"
            style={
              tab === t.id
                ? { background: 'var(--accent)', color: 'white' }
                : { background: 'var(--surface-muted)', color: 'var(--foreground)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'RECORD' && <PatientRecordForm customerId={customerId} simpleInitial={simpleInitial} medicalInitial={medicalRecordInitial} />}
      {tab === 'LETTER' && <MedicalLetterForm customerId={customerId} patientName={patientName} letters={letters} />}
      {tab === 'DOCS' && <PatientDocuments customerId={customerId} patientName={patientName} documents={documents} />}
    </div>
  )
}
