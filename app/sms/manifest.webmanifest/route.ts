import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    id: '/sms', name: 'Gateway SMS Elmont', short_name: 'SMS Elmont', description: 'Mesaje SMS pentru beneficiarii Elmont',
    start_url: '/sms', scope: '/sms', display: 'standalone', lang: 'ro',
    background_color: '#eef6fb', theme_color: '#0c3152',
    icons: [
      { src: '/sms-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/sms-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } })
}
