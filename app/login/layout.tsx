import Link from 'next/link'

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <nav aria-label="Documente juridice" className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-full border border-slate-200 bg-white/95 px-5 py-2 text-xs text-slate-500 shadow-lg backdrop-blur">
        <Link href="/termeni-si-conditii" className="whitespace-nowrap hover:text-blue-600">Termeni și condiții</Link>
        <span className="h-3 w-px bg-slate-200" aria-hidden="true" />
        <Link href="/politica-de-confidentialitate" className="whitespace-nowrap hover:text-blue-600">Confidențialitate</Link>
      </nav>
    </div>
  )
}
