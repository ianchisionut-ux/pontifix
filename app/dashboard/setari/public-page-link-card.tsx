'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'

function CopyableLink({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <a href={path} target="_blank" rel="noopener noreferrer" className="input-field flex-1 truncate text-[var(--accent)]">
          {url}
        </a>
        <button onClick={copy} className="btn-secondary text-sm whitespace-nowrap">
          {copied ? 'Copiat!' : 'Copiază'}
        </button>
      </div>
    </div>
  )
}

export function PublicPageLinkCard({ slug, isClinic, usesAppointments }: { slug: string; isClinic: boolean; usesAppointments: boolean }) {
  return (
    <Card className="mb-5 break-inside-avoid">
      <h2 className="font-medium mb-1">Pagina ta publică</h2>
      <p className="text-sm text-gray-500 mb-3">
        Link-urile pe care le trimiți {isClinic ? 'pacienților' : 'clienților'} sau le pui pe rețele sociale.
      </p>
      <div className="flex flex-col gap-3">
        <CopyableLink path={`/${slug}`} label="Profil public" />
        <CopyableLink path={`/${slug}/rezerva`} label={usesAppointments ? 'Programare directă' : 'Rezervare directă'} />
      </div>
    </Card>
  )
}
