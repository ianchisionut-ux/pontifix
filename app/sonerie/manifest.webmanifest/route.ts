import { NextResponse } from 'next/server'
import { getSonerieRole } from '@/lib/sonerie'

export const dynamic = 'force-dynamic'

export async function GET() {
  const role = await getSonerieRole()
  const code = role === 'director' ? process.env.SONERIE_DIRECTOR_CODE : role === 'ionut' ? process.env.SONERIE_IONUT_CODE : null
  return NextResponse.json({
    id: '/sonerie', name: 'Sonerie birou', short_name: 'Sonerie',
    description: 'Chemare rapidă între director și Ionuț',
    start_url: code ? `/sonerie/acces/${code}` : '/sonerie', scope: '/sonerie', display: 'standalone',
    background_color: '#f5f8fc', theme_color: '#0c3152', lang: 'ro',
    icons: [
      { src: '/sonerie-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/sonerie-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
}
