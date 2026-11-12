import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    id: '/chat', name: 'Chat Elmont', short_name: 'Chat Elmont', description: 'Mesagerie internă Elmont',
    start_url: '/chat', scope: '/', display: 'standalone', lang: 'ro',
    background_color: '#f3f8fc', theme_color: '#0d5d8b',
    icons: [
      { src: '/chat-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/chat-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } })
}
