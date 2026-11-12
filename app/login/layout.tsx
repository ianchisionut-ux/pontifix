import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('host')?.split(':')[0]
  return host === 'chat.elmont.ro' ? {
    title: 'Autentificare · Chat Elmont', applicationName: 'Chat Elmont',
    manifest: '/chat/manifest.webmanifest',
    icons: { icon: '/chat-icon-192.png', apple: '/chat-icon-192.png' },
  } : {}
}

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session) {
    const host = (await headers()).get('host')?.split(':')[0]
    redirect(host === 'chat.elmont.ro' ? '/chat' : '/dashboard')
  }
  return children
}
