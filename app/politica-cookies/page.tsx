import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politica de cookie-uri | Elmont S.A.',
  description: 'Informații despre cookie-urile necesare utilizate de site-ul și portalul Elmont.',
}

export default function CookiePolicyPage() {
  return <main className="min-h-screen bg-[#f7fbfd] px-5 py-12 text-[#082b4d] sm:py-20">
    <article className="mx-auto max-w-3xl rounded-3xl border border-[#d9eef8] bg-white p-6 shadow-lg sm:p-10">
      <Link href="/" className="text-sm font-bold text-[#0d5d8b] hover:underline">← Înapoi la pagina principală</Link>
      <h1 className="mt-7 text-3xl font-black sm:text-4xl">Politica de cookie-uri</h1>
      <p className="mt-3 text-sm text-slate-500">Ultima actualizare: 5 noiembrie 2026</p>
      <div className="mt-8 space-y-7 text-[15px] leading-7 text-slate-700">
        <section><h2 className="text-xl font-bold text-[#082b4d]">Ce sunt cookie-urile</h2><p className="mt-2">Cookie-urile sunt fișiere mici salvate de browser pentru ca site-ul să poată păstra o sesiune și anumite setări. Unele funcții folosesc și stocarea locală a browserului, care nu este un cookie.</p></section>
        <section><h2 className="text-xl font-bold text-[#082b4d]">Ce folosim</h2><p className="mt-2">Pe pagina publică, stocăm local faptul că ai citit informarea despre cookie-uri. În portal, cookie-urile de autentificare și securitate sunt necesare pentru conectare, păstrarea sesiunii și protejarea contului. Preferințele de interfață pot fi păstrate local în browser.</p></section>
        <section><h2 className="text-xl font-bold text-[#082b4d]">Analiză și publicitate</h2><p className="mt-2">În prezent, pagina publică nu activează cookie-uri de analiză sau publicitate. Dacă vom adăuga asemenea servicii, vom actualiza această politică și vom solicita alegerea ta înainte de activarea lor.</p></section>
        <section><h2 className="text-xl font-bold text-[#082b4d]">Cum le controlezi</h2><p className="mt-2">Poți șterge sau bloca cookie-urile și datele locale din setările browserului. Blocarea cookie-urilor necesare poate împiedica autentificarea în portal. Informarea de pe prima pagină poate reapărea după ștergerea datelor locale.</p></section>
        <section><h2 className="text-xl font-bold text-[#082b4d]">Contact</h2><p className="mt-2">Pentru întrebări, scrie la <a href="mailto:elmont_zalau@yahoo.com" className="font-semibold text-[#0d5d8b] underline">elmont_zalau@yahoo.com</a>. Vezi și <Link href="/politica-de-confidentialitate" className="font-semibold text-[#0d5d8b] underline">politica de confidențialitate</Link>.</p></section>
      </div>
    </article>
  </main>
}
