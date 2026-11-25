import { Download } from 'lucide-react'

const documents = [
  { label: 'Contract', part: 'contract-only' },
  { label: 'Notificare', part: 'notification-only' },
  { label: 'Memoriu', part: 'memorandum-only' },
  { label: 'Cerere', part: 'request-only' },
] as const

export function ConnectionDocumentButtons({ id, disabled = false }: { id: string; disabled?: boolean }) {
  return <>{documents.map(({ label, part }) => <a
    key={part}
    href={disabled ? undefined : `/api/bransamente/${encodeURIComponent(id)}/document?type=contract&part=${part}`}
    className={`btn-secondary inline-flex items-center gap-2 whitespace-nowrap ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    aria-disabled={disabled}
    title={disabled ? 'Salvează fișa înainte de descărcare.' : undefined}
    download={!disabled}
  ><Download size={16}/>{label}</a>)}</>
}

export function ConnectionA3DownloadButtons({ id, disabled = false }: { id: string; disabled?: boolean }) {
  const baseUrl = `/api/bransamente/${encodeURIComponent(id)}/document?type=a3`
  const className = `btn-secondary inline-flex items-center gap-2 whitespace-nowrap ${disabled ? 'cursor-not-allowed opacity-50' : ''}`
  return <>
    <a href={disabled ? undefined : baseUrl} className={className} aria-disabled={disabled} title={disabled ? 'Salvează fișa înainte de descărcare.' : undefined} download={!disabled}>
      <Download size={16}/> Dosar A3 DOCX
    </a>
    <a href={disabled ? undefined : `${baseUrl}&format=pdf`} className={className} aria-disabled={disabled} title={disabled ? 'Salvează fișa înainte de descărcare.' : undefined} download={!disabled}>
      <Download size={16}/> Dosar A3 PDF
    </a>
  </>
}
