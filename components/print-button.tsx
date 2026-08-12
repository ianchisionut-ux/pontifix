'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      aria-label="Printează"
      title="Printează"
      className="btn-secondary text-sm flex items-center gap-1.5"
    >
      <Printer size={16} strokeWidth={2} /> Printează
    </button>
  )
}
