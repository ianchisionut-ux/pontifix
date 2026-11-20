import { Download } from 'lucide-react'

const documents = [
  { label: 'Contract', part: 'contract-only' },
  { label: 'Notificare', part: 'notification-only' },
  { label: 'Memoriu', part: 'memorandum-only' },
  { label: 'Cerere', part: 'request-only' },
] as const

export function ConnectionDocumentButtons({ id }: { id: string }) {
  return <>{documents.map(({ label, part }) => <a
    key={part}
    href={`/api/bransamente/${encodeURIComponent(id)}/document?type=contract&part=${part}`}
    className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap"
    download
  ><Download size={16}/>{label}</a>)}</>
}

export function ConnectionA3DownloadButtons({ id }: { id: string }) {
  const baseUrl = `/api/bransamente/${encodeURIComponent(id)}/document?type=a3`
  return <>
    <a href={baseUrl} className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap" download>
      <Download size={16}/> Dosar A3 DOCX
    </a>
    <a href={`${baseUrl}&format=pdf`} className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap" download>
      <Download size={16}/> Dosar A3 PDF
    </a>
  </>
}
