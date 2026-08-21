import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Elmont S.A.',
    short_name: 'Elmont',
    description: 'Portalul public și intern Elmont S.A.',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0d5d8b',
    orientation: 'any',
    lang: 'ro',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/pwa-icon-v2-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-v2-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Prezentare', short_name: 'Prezentare', url: '/dashboard', icons: [{ src: '/pwa-icon-v2-192.png', sizes: '192x192' }] },
      { name: 'Proiecte', short_name: 'Proiecte', url: '/dashboard/proiecte', icons: [{ src: '/pwa-icon-v2-192.png', sizes: '192x192' }] },
      { name: 'Branșamente', short_name: 'Branșamente', url: '/dashboard/bransamente', icons: [{ src: '/pwa-icon-v2-192.png', sizes: '192x192' }] },
    ],
  }
}
