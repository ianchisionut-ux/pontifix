import MapClient from './map-client'
import { PublicHeader } from '@/components/ui/public-header'

export const metadata = {
  title: 'Afaceri pe bookeasy.ro — Hartă',
  description: 'Descoperă saloane și spații de evenimente care folosesc bookeasy.ro',
}

export default function HartaPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <PublicHeader />
      <div className="px-6 py-4 border-b border-[var(--border-soft)] bg-white">
        <h1 className="text-xl font-semibold">Afaceri pe bookeasy.ro</h1>
        <p className="text-sm text-gray-500">Saloane și spații de evenimente care folosesc platforma</p>
      </div>
      <MapClient />
    </main>
  )
}
