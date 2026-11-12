import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Sonerie birou',
  description: 'Chemare rapidă între director și Ionuț',
  applicationName: 'Sonerie birou',
  manifest: '/sonerie/manifest.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Sonerie', statusBarStyle: 'default' },
  icons: { icon: '/sonerie-icon-192.png', apple: '/sonerie-icon-192.png' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0c3152' }

export default function Layout({ children }: { children: React.ReactNode }) { return children }
