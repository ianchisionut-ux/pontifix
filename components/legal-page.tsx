import Link from 'next/link'
import { ElmontLogo } from '@/components/elmont-logo'

type Section = { title: string; content: React.ReactNode }

export function LegalPage({ title, description, updatedAt, sections }: {
  title: string
  description: string
  updatedAt: string
  sections: Section[]
}) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/login" aria-label="Înapoi la autentificare"><ElmontLogo /></Link>
          <Link href="/login" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Înapoi la autentificare</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600">Document juridic</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">{description}</p>
          <p className="mt-4 text-sm text-slate-400">Ultima actualizare: {updatedAt}</p>
        </div>
        <article className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {sections.map((section, index) => (
            <section key={section.title} className={`px-6 py-7 sm:px-10 ${index ? 'border-t border-slate-100' : ''}`}>
              <h2 className="text-xl font-bold tracking-tight">{index + 1}. {section.title}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-600">{section.content}</div>
            </section>
          ))}
        </article>
        <footer className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
          <Link href="/termeni-si-conditii" className="hover:text-blue-600">Termeni și condiții</Link>
          <Link href="/politica-de-confidentialitate" className="hover:text-blue-600">Politica de confidențialitate</Link>
          <a href="mailto:elmont_zalau@yahoo.com" className="hover:text-blue-600">Contact: elmont_zalau@yahoo.com</a>
        </footer>
      </div>
    </main>
  )
}
