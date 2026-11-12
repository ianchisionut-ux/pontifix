'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { Download, LogOut, MessageCircle } from 'lucide-react'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function ChatAppToolbar() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  return <header className="flex shrink-0 items-center justify-between gap-3 border-b border-blue-100 bg-white px-4 py-3 shadow-sm">
    <div className="flex items-center gap-2 font-bold text-[#082b4d]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0d5d8b] text-white"><MessageCircle size={20}/></span><span>Chat Elmont</span></div>
    <div className="flex items-center gap-2">{installPrompt&&<button type="button" aria-label="Instalează Chat Elmont" onClick={install} className="btn-secondary inline-flex items-center gap-2"><Download size={16}/><span className="hidden sm:inline">Instalează</span></button>}<button type="button" aria-label="Ieșire din Chat Elmont" onClick={() => signOut({ callbackUrl: '/login' })} className="btn-secondary inline-flex items-center gap-2"><LogOut size={16}/><span className="hidden sm:inline">Ieșire</span></button></div>
  </header>
}
