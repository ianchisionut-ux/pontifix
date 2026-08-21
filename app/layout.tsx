import type { Metadata, Viewport } from 'next'
import './globals.css'
import { LanguageProvider } from '@/components/language-provider'
import { PwaRegistration } from '@/components/pwa-registration'

export const metadata: Metadata = {
  metadataBase: new URL('https://elmontz.vercel.app'),
  title: 'Elmont S.A. — Proiectare și execuție instalații electrice',
  description: 'Proiectare și execuție rețele electrice, branșamente și posturi de transformare 0,4–20 kV. Elmont S.A., Zalău, din 1997.',
  applicationName: 'Elmont S.A.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Elmont',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/pwa-icon-v2-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon-v2.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'Elmont',
  },
  openGraph: { title: 'Elmont S.A. — Putere pentru proiecte reale', description: 'Proiectare, execuție și mentenanță pentru infrastructură electrică 0,4–20 kV.', url: 'https://elmontz.vercel.app', siteName: 'Elmont S.A.', locale: 'ro_RO', type: 'website', images: [{ url: '/og.png', width: 1732, height: 908, alt: 'Elmont S.A. — Putere pentru proiecte reale' }] },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d5d8b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ro"><body><PwaRegistration/><LanguageProvider>{children}</LanguageProvider></body></html>
}
