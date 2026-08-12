import Image from 'next/image'
import Link from 'next/link'

export default function ContSuspendatPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--surface-muted)] px-6">
      <div className="max-w-sm text-center flex flex-col items-center gap-4">
        <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={40} height={40} />
        <h1 className="text-lg font-semibold">Cont temporar suspendat</h1>
        <p className="text-sm text-gray-500">
          Contul tău a fost dezactivat de echipa bookeasy.ro. Te rugăm să ne contactezi pentru
          detalii sau pentru reactivare.
        </p>
        <Link href="/" className="btn-secondary">
          Înapoi la pagina principală
        </Link>
      </div>
    </main>
  )
}
