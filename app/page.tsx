import Image from 'next/image'
import Link from 'next/link'
import MapClient from './harta/map-client'
import AccessRequestForm from '@/components/access-request-form'
import { MessageCircle, Bot, CalendarDays, Bell, Clock, CreditCard, Star, BarChart3, Globe } from 'lucide-react'

const STEPS = [
  {
    icon: MessageCircle,
    title: 'Clientul scrie pe WhatsApp, Instagram sau Facebook',
    desc: 'Fără app de instalat, fără cont creat — clientul scrie exact cum ar scrie oricui altcuiva.',
  },
  {
    icon: Bot,
    title: 'Botul preia conversația',
    desc: 'Întreabă ce serviciu vrea, oferă ore libere, confirmă rezervarea — totul automat, în română.',
  },
  {
    icon: CalendarDays,
    title: 'Tu vezi totul într-un calendar',
    desc: 'Rezervări din toate canalele, într-un singur loc. Nimic de introdus manual.',
  },
]

const FEATURES = [
  { icon: Bell, title: 'Reamintiri automate', desc: 'Clientul primește mesaj înainte de programare — mai puține neprezentări.' },
  { icon: Clock, title: 'Program flexibil', desc: 'Ore libere calculate automat, după programul tău și durata fiecărui serviciu.' },
  { icon: CreditCard, title: 'Plată online, opțional', desc: 'Avans la rezervare, dacă vrei — cardul se leagă simplu de contul tău.' },
  { icon: Star, title: 'Recenzii verificate', desc: 'Doar clienți care chiar au avut o programare pot lăsa recenzie.' },
  { icon: BarChart3, title: 'Statistici clare', desc: 'Vezi de unde vin clienții, care sunt orele aglomerate, ce servicii se cer.' },
  { icon: Globe, title: 'Pagină publică proprie', desc: 'Un link de trimis clienților sau de pus pe rețele sociale, gata de rezervat.' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center gap-6 sm:gap-8 px-4 sm:px-6 text-center py-12 sm:py-16">
        <Image src="/logo.png" alt="bookeasy.ro" width={280} height={187} priority className="w-[180px] sm:w-[240px] h-auto" />

        <div className="max-w-lg flex flex-col gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold">Rezervări automate pe WhatsApp, Instagram și Facebook</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Pentru saloane, spații de evenimente, hoteluri și pensiuni. Botul preia rezervările,
            tu vezi totul într-un singur calendar — fără să răspunzi manual la fiecare mesaj.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto px-6 sm:px-0">
          <a href="#cere-acces" className="btn-primary">
            Vreau și eu — cere acces
          </a>
          <Link href="/dashboard" className="btn-secondary">
            Am deja cont
          </Link>
        </div>
      </div>

      {/* Cum funcționează */}
      <div className="bg-white border-y border-[var(--border-soft)] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-semibold text-center mb-2">Cum funcționează</h2>
          <p className="text-sm text-gray-500 text-center mb-10">Trei pași, fără nimic de instalat pentru clienții tăi</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--surface-muted)] flex items-center justify-center mx-auto mb-3">
                  <s.icon size={22} strokeWidth={1.75} className="text-gray-500" />
                </div>
                <h3 className="font-medium mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Funcționalități */}
      <div className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-semibold text-center mb-10">Tot ce ai nevoie, într-un singur loc</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="card p-5">
                <div className="w-9 h-9 rounded-lg bg-[var(--surface-muted)] flex items-center justify-center mb-3">
                  <f.icon size={18} strokeWidth={1.75} className="text-gray-500" />
                </div>
                <h3 className="font-medium mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cere acces */}
      <div id="cere-acces" className="bg-white border-y border-[var(--border-soft)] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl sm:text-2xl font-semibold text-center mb-2">Hai să pornim</h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Lasă-ne datele tale — îți configurăm contul și te contactăm în scurt timp.
          </p>
          <AccessRequestForm />
        </div>
      </div>

      {/* Descoperă afaceri (pentru clienți finali) */}
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-lg font-semibold mb-1 text-center">Afaceri pe bookeasy.ro</h2>
        <p className="text-sm text-gray-500 mb-4 text-center">Descoperă saloane și spații de evenimente lângă tine</p>
        <MapClient />
      </div>
    </main>
  )
}
