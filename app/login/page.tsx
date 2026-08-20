'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { ElmontLogo } from '@/components/elmont-logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useLanguage } from '@/components/language-provider'

export default function LoginPage() {
  const router = useRouter()
  const { tr } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('credentials', { email, password, remember: rememberMe ? 'true' : 'false', redirect: false })
    if (result?.error) {
      setError('Email sau parolă greșită.')
      setLoading(false)
      return
    }
    await fetch('/api/auth/remember-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remember: rememberMe }) }).catch(() => undefined)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#f4fafd] lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden lg:block">
        <Image src="/elmont-hero-light.png" alt="Infrastructură electrică Elmont" fill priority sizes="55vw" className="object-cover object-[61%_center]"/>
        <div className="absolute inset-0 bg-gradient-to-r from-white/96 via-white/65 to-[#dff1f9]/10"/>
        <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-white/98 via-[#eaf5fb]/88 to-white/10"/>
        <div className="relative flex h-full min-h-screen flex-col justify-between p-12 xl:p-16">
          <Link href="/" className="w-fit"><ElmontLogo /></Link>
          <div className="max-w-xl text-[#082b4d]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#8bc8e5] bg-white/80 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#0f679b] shadow-sm backdrop-blur"><ShieldCheck size={14}/> Acces securizat</span>
            <h1 className="mt-6 text-5xl font-black leading-[.98] tracking-[-.055em] xl:text-6xl">{tr('Portalul intern')}<br/>Elmont S.A.</h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">Un singur punct de acces pentru informațiile, documentele și operațiunile companiei.</p>
            <p className="mt-9 flex items-center gap-3 text-sm font-semibold text-[#0f679b]"><LockKeyhole size={17}/> Conexiune protejată · acces doar pentru utilizatori autorizați</p>
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-20 sm:px-10">
        <div className="absolute right-8 top-7 hidden items-center gap-3 sm:flex"><LanguageSwitcher/><Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#197fb5]"><ArrowLeft size={16}/> {tr('Înapoi la site')}</Link></div>
        <div className="w-full max-w-[460px]">
          <Link href="/" className="mb-12 inline-flex lg:hidden"><ElmontLogo /></Link>
          <span className="text-xs font-black uppercase tracking-[.18em] text-[#197fb5]">{tr('Portal companie')}</span>
          <h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#082b4d]">{tr('Autentificare')}</h2>
          <p className="mt-3 text-slate-500">{tr('Introdu datele contului tău Elmont.')}</p>

          <form onSubmit={submit} className="mt-9 space-y-5">
            <label className="block text-sm font-bold text-slate-700">Email
              <input className="mt-2 h-14 w-full rounded-2xl border border-[#dbe5f0] bg-white px-4 text-[#082b4d] outline-none transition focus:border-[#49a6d4] focus:ring-4 focus:ring-[#49a6d4]/10" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required/>
            </label>
            <label className="block text-sm font-bold text-slate-700">{tr('Parolă')}
              <span className="relative mt-2 block">
                <input className="h-14 w-full rounded-2xl border border-[#dbe5f0] bg-white px-4 pr-12 text-[#082b4d] outline-none transition focus:border-[#49a6d4] focus:ring-4 focus:ring-[#49a6d4]/10" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/>
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 hover:bg-[#edf7fc] hover:text-[#197fb5]" aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button>
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-600"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-5 w-5 rounded border-slate-300 accent-[#197fb5]"/><span>{tr('Ține-mă autentificat pe acest dispozitiv')}</span></label>
            {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p>}
            <button className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0d5d8b] to-[#2f91c8] font-extrabold text-white shadow-xl shadow-[#197fb5]/20 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70" disabled={loading}>{loading ? tr('Se conectează...') : <>{tr('Intră în portal')} <ArrowRight size={18} className="transition group-hover:translate-x-1"/></>}</button>
          </form>
          <Link href="/forgot-password" className="mt-6 block text-center text-sm font-bold text-slate-500 transition hover:text-[#197fb5]">{tr('Am uitat parola')}</Link>
          <div className="mt-10 flex items-center justify-center gap-2 border-t border-slate-200 pt-6 text-xs text-slate-400"><LockKeyhole size={14}/> Sesiune securizată Elmont</div><div className="mt-4 flex justify-center gap-4 text-xs text-slate-400"><Link href="/termeni-si-conditii" className="hover:text-[#197fb5]">{tr('Termeni și condiții')}</Link><Link href="/politica-de-confidentialitate" className="hover:text-[#197fb5]">{tr('Confidențialitate')}</Link></div>
        </div>
      </section>
    </main>
  )
}
