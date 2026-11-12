import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Chat Elmont', description: 'Mesagerie internă Elmont', applicationName: 'Chat Elmont',
  manifest: '/chat/manifest.webmanifest', robots: { index: false, follow: false },
  icons: { icon: '/chat-icon-192.png', apple: '/chat-icon-192.png' },
  appleWebApp: { capable: true, title: 'Chat Elmont', statusBarStyle: 'default' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0d5d8b' }

export default function ChatLayout({ children }: { children: React.ReactNode }) { return children }
