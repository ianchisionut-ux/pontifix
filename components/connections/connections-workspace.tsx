'use client'

import { useState } from 'react'
import { ClipboardCheck, FolderKanban } from 'lucide-react'
import { ConnectionsManager } from '@/components/connections/connections-manager'
import { ConnectionReceptionsRegister } from '@/components/connections/connection-receptions-register'
import type { ConnectionCaseDto } from '@/lib/connection-fields'
import type { ConnectionReceptionDto } from '@/lib/connection-reception-storage'

export function ConnectionsWorkspace({ initialCases, initialReceptions, canManage, canEditDeerDate }: { initialCases: ConnectionCaseDto[]; initialReceptions: ConnectionReceptionDto[]; canManage: boolean; canEditDeerDate: boolean }) {
  const [section, setSection] = useState<'CASES' | 'RECEPTIONS'>('CASES')
  return <div>
    <div className="screen-only mb-6 inline-flex rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
      <button type="button" onClick={() => setSection('CASES')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black ${section==='CASES'?'bg-[#0d5d8b] text-white':'text-slate-500 hover:bg-slate-50'}`}><FolderKanban size={17}/> Dosare branșamente</button>
      <button type="button" onClick={() => setSection('RECEPTIONS')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black ${section==='RECEPTIONS'?'bg-[#0d5d8b] text-white':'text-slate-500 hover:bg-slate-50'}`}><ClipboardCheck size={17}/> Recepții <span className={`rounded-full px-2 py-0.5 text-[10px] ${section==='RECEPTIONS'?'bg-white/20':'bg-slate-100'}`}>{initialReceptions.length}</span></button>
    </div>
    {section === 'CASES'
      ? <ConnectionsManager initialCases={initialCases} canManage={canManage} canEditDeerDate={canEditDeerDate}/>
      : <ConnectionReceptionsRegister initialRecords={initialReceptions} canManage={canManage}/>
    }
  </div>
}