'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { FileText } from 'lucide-react'

type Doc = { id: string; url: string; filename: string; uploadedAt: string }

export default function PatientDocuments({
  customerId,
  patientName,
  documents,
}: {
  customerId: string
  patientName: string
  documents: Doc[]
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetchWithTimeout(`/api/business/patients/${customerId}/documents`, { method: 'POST', body: formData }, 60000)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Upload eșuat.')
        return
      }
      router.refresh()
    } catch {
      setError('Conexiune eșuată sau upload prea lent. Încearcă din nou.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Ștergi acest document?')) return
    try {
      await fetchWithTimeout(`/api/business/patients/${customerId}/documents/${docId}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      alert('Conexiune eșuată. Încearcă din nou.')
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Documente</h2>
        <div className="flex items-center gap-2">
          <label className="btn-secondary text-sm cursor-pointer">
            {uploading ? 'Se încarcă...' : '+ Adaugă document'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-3">Radiografii, trimiteri, acte de identitate — orice document relevant.</p>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">Niciun document încă.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-[var(--surface-muted)]">
              <a href={doc.url} className="text-sm text-[var(--accent)] font-medium truncate">
                <FileText size={14} className="inline mr-1" style={{ verticalAlign: '-2px' }} /> {doc.filename}
              </a>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400">
                  {new Date(doc.uploadedAt).toLocaleDateString('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' })}
                </span>
                <button onClick={() => handleDelete(doc.id)} className="text-xs text-red-600 font-medium">
                  Șterge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
