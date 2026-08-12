import Image from 'next/image'
import Link from 'next/link'

export default function PlataConfirmata() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--surface-muted)] px-6">
      <div className="max-w-sm text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl">✓</div>
        <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={32} height={32} />
        <h1 className="text-lg font-semibold">Plata a fost confirmată</h1>
        <p className="text-sm text-gray-500">
          Avansul tău a fost înregistrat. Vei primi un mesaj de confirmare pe canalul prin care ai
          făcut rezervarea.
        </p>
        <Link href="/" className="btn-secondary">
          Înapoi la bookeasy.ro
        </Link>
      </div>
    </main>
  )
}
