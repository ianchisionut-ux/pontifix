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
