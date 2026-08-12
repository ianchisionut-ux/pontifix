'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { PontifixLogo } from '@/components/pontifix-logo'
import { CalendarCheck2, FileDown, UsersRound } from 'lucide-react'

export default function LoginPage() {
  const router=useRouter(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false)
  async function submit(e:React.FormEvent){e.preventDefault();setError('');setLoading(true);const result=await signIn('credentials',{email,password,redirect:false});if(result?.error){setError('Email sau parolă greșită.');setLoading(false);return}router.push('/dashboard');router.refresh()}
  return <main className="login-shell min-h-screen grid lg:grid-cols-[1.08fr_.92fr]">
    <section className="login-hero hidden lg:flex p-12 xl:p-16 flex-col justify-between text-white">
      <PontifixLogo inverted/>
      <div className="max-w-2xl">
        <span className="login-eyebrow">Pontaj simplu. Echipă organizată.</span>
        <h1 className="text-5xl xl:text-6xl font-semibold leading-[1.08] tracking-[-0.045em] mt-6">Fiecare zi de lucru,<br/>clară și la locul ei.</h1>
        <p className="text-blue-100/75 text-lg mt-6 max-w-xl">Prezență, foi lunare, concedii și statistici într-un spațiu construit pentru echipe reale.</p>
        <div className="grid grid-cols-3 gap-3 mt-10 max-w-xl">
          <div className="login-feature"><CalendarCheck2 size={20}/><span>Pontaj rapid</span></div>
          <div className="login-feature"><UsersRound size={20}/><span>Echipă clară</span></div>
          <div className="login-feature"><FileDown size={20}/><span>PDF A4</span></div>
        </div>
      </div>
      <p className="text-sm text-blue-200/55">Pontifix · Administrarea timpului de lucru</p>
    </section>
    <section className="flex items-center justify-center p-6 sm:p-10">
      <div className="login-card w-full max-w-md">
        <PontifixLogo className="lg:hidden mb-10"/>
        <span className="text-sm text-blue-600 font-semibold">Bine ai revenit</span>
        <h2 className="text-3xl font-semibold tracking-[-0.035em] mt-2">Intră în cont</h2>
        <p className="text-slate-500 mt-2 mb-8">Accesează pontajele și datele echipei tale.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Email<input className="input-field w-full mt-2 h-12" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
          <label className="block text-sm font-medium">Parolă<input className="input-field w-full mt-2 h-12" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
          {error&&<p className="text-sm text-rose-600">{error}</p>}
          <button className="btn-primary w-full h-12 mt-2" disabled={loading}>{loading?'Se conectează...':'Intră în Pontifix'}</button>
        </form>
        <Link href="/forgot-password" className="text-sm text-slate-500 hover:text-blue-600 block text-center mt-5">Am uitat parola</Link>
      </div>
    </section>
  </main>
}
