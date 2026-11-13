import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Gateway SMS Elmont', description: 'Gateway SMS pentru branșamente Elmont', applicationName: 'Gateway SMS Elmont',
  manifest: '/sms/manifest.webmanifest', robots: { index: false, follow: false },
  icons: { icon: '/sms-icon-192.png', apple: '/sms-icon-192.png' },
  appleWebApp: { capable: true, title: 'SMS Elmont', statusBarStyle: 'default' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0c3152' }

export default function SmsLayout({ children }: { children: React.ReactNode }) { return children }
