'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'elmont-cookie-notice-v1'

export function PublicCookieNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try { setVisible(window.localStorage.getItem(STORAGE_KEY) !== 'seen') }
    catch { setVisible(true) }
  }, [])

  function dismiss() {
    try { window.localStorage.setItem(STORAGE_KEY, 'seen') } catch { /* Storage may be disabled. */ }
    setVisible(false)
  }

  if (!visible) return null

  return <aside aria-label="Informare cookie-uri" className="fixed bottom-4 left-4 right-4 z-[80] max-w-xl rounded-2xl border border-[#b9dceb] bg-white p-5 text-[#082b4d] shadow-2xl shadow-[#082b4d]/25 sm:bottom-6 sm:left-6 sm:right-auto">
    <h2 className="text-lg font-extrabold">Cookie-uri pe site-ul Elmont</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Folosim doar cookie-uri necesare pentru funcționarea și securitatea site-ului și a portalului. Nu folosim cookie-uri de publicitate sau analiză pe pagina publică.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={dismiss} className="rounded-full bg-[#082b4d] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0d5d8b]">Am înțeles</button>
      <Link href="/politica-cookies" className="text-sm font-bold text-[#0d5d8b] underline underline-offset-4 hover:text-[#082b4d]">Politica de cookie-uri</Link>
    </div>
  </aside>
}
