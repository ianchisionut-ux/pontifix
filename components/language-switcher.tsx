'use client'

import { Languages } from 'lucide-react'
import { useLanguage, type Language } from '@/components/language-provider'

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage()
  return <div className={`inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm ${compact ? '' : 'gap-1'}`}>
    {!compact && <Languages size={15} className="ml-1.5 text-slate-400"/>}
    {(['ro','hu','en'] as Language[]).map(item => <button key={item} type="button" onClick={() => setLanguage(item)} className={`rounded-lg px-2 py-1.5 text-[11px] font-extrabold uppercase ${language===item?'bg-[#0d5d8b] text-white':'text-slate-500 hover:bg-slate-50'}`} aria-label={`Language ${item.toUpperCase()}`}>{item}</button>)}
  </div>
}
