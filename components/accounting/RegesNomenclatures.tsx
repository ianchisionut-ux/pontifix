'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { regesNomenclatures } from '@/lib/accounting/reges-shared'

type Catalog = {total:number;matched:number;updatedAt:string|null;entries:Array<Record<string,unknown>>}
const names:Record<string,string>={Cor:'Ocupații COR',DomeniuActivitate:'Activități CAEN',TipSporPredefinit:'Sporuri standard',Nationalitate:'Naționalități',Judet:'Județe',Localitate:'Localități SIRUTA',StareContractMunca:'Stări contract',TipContractMunca:'Tipuri contract',TipNorma:'Tipuri normă',NormaTimpMunca:'Norme timp de muncă',TemeiSuspendare:'Temeiuri suspendare',TemeiIncetare:'Temeiuri încetare',TipLocMunca:'Tipuri loc de muncă',Moneda:'Monede'}

export function RegesNomenclatures() {
  const [kind,setKind]=useState('Cor')
  const [environment,setEnvironment]=useState('test')
  const [draft,setDraft]=useState('')
  const [query,setQuery]=useState('')
  const [version,setVersion]=useState(0)
  const [catalog,setCatalog]=useState<Catalog|null>(null)
  const [loading,setLoading]=useState(false)
  const [syncing,setSyncing]=useState(false)
  const [notice,setNotice]=useState<{error:boolean;text:string}|null>(null)
  const pending=useRef(false)
  useEffect(() => {
    const controller=new AbortController()
    setLoading(true);setCatalog(null)
    fetch(`/api/accounting/integrations?${new URLSearchParams({catalog:kind,environment,q:query})}`,{cache:'no-store',signal:controller.signal})
      .then(async response => {const result=await response.json();if(!response.ok)throw new Error(result.error || 'Nomenclatorul nu a putut fi încărcat.');return result as Catalog})
      .then(result => {if(!controller.signal.aborted)setCatalog(result)})
      .catch(error => {if(!controller.signal.aborted)setNotice({error:true,text:error.message})})
      .finally(() => {if(!controller.signal.aborted)setLoading(false)})
    return () => controller.abort()
  },[kind,environment,query,version])
  async function sync() {
    if(pending.current)return
    pending.current=true;setSyncing(true);setNotice(null)
    try {
      const response=await fetch('/api/accounting/integrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'syncRegesNomenclature',kind,environment})})
      const result=await response.json()
      if(!response.ok)throw new Error(result.error || 'Sincronizarea a eșuat.')
      setNotice({error:false,text:result.message});setVersion(current => current+1)
    } catch(error) {setNotice({error:true,text:error instanceof Error?error.message:'Sincronizarea a eșuat.'})}
    finally {pending.current=false;setSyncing(false)}
  }
  return <section className="card institution-catalog">
    <div className="institution-panel-heading"><div><h2>Nomenclatoare REGES</h2><p>Liste oficiale, separate pe mediu. Sincronizarea listelor publice nu necesită credențiale REGES.</p></div></div>
    <div className="institution-catalog-controls">
      <label className="field-label">Nomenclator<select className="input" value={kind} disabled={syncing} onChange={event => {setKind(event.target.value);setNotice(null);setDraft('');setQuery('')}}>{regesNomenclatures.map(value => <option key={value} value={value}>{names[value] || value}</option>)}</select></label>
      <label className="field-label">Mediu nomenclatoare<select className="input" value={environment} disabled={syncing} onChange={event => {setEnvironment(event.target.value);setNotice(null)}}><option value="test">Test oficial</option><option value="production">Producție</option></select></label>
      <button type="button" className="btn-secondary" disabled={syncing} onClick={() => void sync()}><RefreshCw size={14} className={syncing?'animate-spin':undefined}/>{syncing?'Se sincronizează…':'Sincronizează lista oficială'}</button>
    </div>
    {notice && <p role={notice.error?'alert':'status'} className={`institution-notice ${notice.error?'is-error':''}`}>{notice.text}</p>}
    <form className="institution-catalog-search" onSubmit={event => {event.preventDefault();setQuery(draft)}}><label className="field-label" htmlFor="reges-catalog-query">Caută după cod sau denumire</label><div className="institution-actions"><input id="reges-catalog-query" className="input" maxLength={100} value={draft} onChange={event => setDraft(event.target.value)}/><button className="btn-secondary" disabled={loading}><Search size={14}/> Caută</button></div></form>
    <p className="institution-help">{loading?'Se încarcă lista…':catalog?.updatedAt?`${catalog.total.toLocaleString('ro-RO')} înregistrări · actualizat ${new Date(catalog.updatedAt).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})}. Se afișează primele 50 din ${catalog.matched.toLocaleString('ro-RO')} rezultate.`:'Nomenclatorul nu a fost sincronizat pentru acest mediu.'}</p>
    {!!catalog?.entries.length && <div className="card-table"><table><thead><tr><th>Cod</th><th>Denumire</th><th>Versiune</th><th>Curentă</th></tr></thead><tbody>{catalog.entries.map((entry,index) => <tr key={`${String(entry.id)}-${index}`}><td title={String(entry.id)}>{String(entry.cod ?? entry.codSiruta ?? '—')}</td><td>{String(entry.nume ?? entry.denumire ?? '—')}</td><td>{String(entry.versiune ?? '—')}</td><td>{typeof entry.versiuneCurenta==='boolean' ? entry.versiuneCurenta?'Da':'Nu':'—'}</td></tr>)}</tbody></table></div>}
  </section>
}
