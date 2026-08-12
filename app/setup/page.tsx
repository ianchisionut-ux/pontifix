'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter(); const [available,setAvailable]=useState<boolean|null>(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  useEffect(()=>{fetch('/api/setup').then(r=>r.json()).then(d=>setAvailable(d.setupAvailable))},[])
  async function submit(formData:FormData){setBusy(true);setError('');const r=await fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(formData))});const d=await r.json();setBusy(false);if(!r.ok)return setError(d.error||'Configurarea nu a reușit.');router.push('/login')}
  if(available===null)return <main className="min-h-screen grid place-items-center bg-[#f5f6f2]">Se verifică...</main>
  if(!available)return <main className="min-h-screen grid place-items-center bg-[#f5f6f2] p-6"><div className="card p-8 max-w-md text-center"><h1 className="text-xl font-semibold">Pontifix este deja configurat</h1><button className="btn-primary mt-5" onClick={()=>router.push('/login')}>Mergi la autentificare</button></div></main>
  return <main className="min-h-screen bg-[#f5f6f2] grid place-items-center p-6"><form action={submit} className="bg-white rounded-3xl shadow-xl shadow-slate-200 p-7 w-full max-w-lg"><p className="text-violet-600 font-medium text-sm">Pontifix</p><h1 className="text-3xl font-semibold tracking-tight mt-2">Configurează organizația</h1><p className="text-slate-500 mt-2 mb-7">Creează prima companie și contul de administrator.</p><div className="space-y-4"><label className="block text-sm font-medium">Denumirea companiei<input name="companyName" className="input-field w-full mt-2 h-12" required/></label><label className="block text-sm font-medium">Email administrator<input name="email" type="email" className="input-field w-full mt-2 h-12" required/></label><label className="block text-sm font-medium">Parolă<input name="password" type="password" minLength={10} className="input-field w-full mt-2 h-12" required/></label></div>{error&&<p className="text-sm text-rose-600 mt-4">{error}</p>}<button className="btn-primary w-full h-12 mt-6" disabled={busy}>{busy?'Se configurează...':'Creează organizația'}</button></form></main>
}
