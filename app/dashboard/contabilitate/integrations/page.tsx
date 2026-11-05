'use client'

import { useEffect, useRef, useState } from 'react'
import './institutions.css'
import { ArrowRight, CheckCircle2, CloudCog, Download, FileUp, Link2, RefreshCw, ShieldCheck, Truck, TriangleAlert, Users, X } from 'lucide-react'
import { RegesNomenclatures } from '@/components/accounting/RegesNomenclatures'
import { regesResultLabel, type RegesMessage } from '@/lib/accounting/reges-shared'

type Overview = { anaf:{ configured:boolean; connected:boolean; environment:'test'|'production' }; firm:{name:string;cif:string}; connections:Array<{service:string;environment:string}>; queue:Array<{environment:string;state:string;exchangeId:number|null}>; exchanges:Array<{id:number;service:string;environment:string;action:string;httpStatus:number;createdAt:string;metadata:RegesMessage|null;results:Array<{id:number;metadata:RegesMessage}>|null}> }
const actionLabels:Record<string,string> = { list:'Listare mesaje', status:'Verificare stare', download:'Descărcare', upload:'Transmitere XML', profile:'Profil angajator', read:'Citire răspuns',commit:'Confirmare citire' }
const environmentLabel = (value?:string) => value === 'production' ? 'Producție' : value === 'test' ? 'Test oficial' : 'Neconfigurat'

function RegesResponseDetails({row}:{row:Overview['exchanges'][number]}) {
  if (!row.metadata) return null
  const results=row.results || []
  const result=results.find(value => value.metadata.code==='FAIL' || value.metadata.codeType==='ERROR')?.metadata || results.at(-1)?.metadata || row.metadata
  return <details className="institution-result"><summary>{regesResultLabel(result)}</summary>
    <dl><dt>Recipisă</dt><dd>{row.metadata.responseId}</dd>{row.metadata.messageId && <><dt>ID mesaj</dt><dd>{row.metadata.messageId}</dd></>}</dl>
    {(results.length ? results.map(value => ({key:value.id,value:value.metadata})) : [{key:row.id,value:row.metadata}]).map(({key,value}) => <div key={key}>{value.description && <p>{value.description}</p>}<dl>{value.ref && <><dt>Referință primară</dt><dd>{value.ref}</dd></>}{value.secondaryRef && <><dt>Referință secundară</dt><dd>{value.secondaryRef}</dd></>}</dl></div>)}
  </details>
}

export default function IntegrationsPage() {
  const [overview,setOverview] = useState<Overview|null>(null)
  const [service,setService] = useState('ETRANSPORT')
  const [entity,setEntity] = useState('Salariat')
  const [reference,setReference] = useState('')
  const [xml,setXml] = useState('')
  const [fileName,setFileName] = useState('')
  const [requestId,setRequestId] = useState('')
  const [busy,setBusy] = useState(false)
  const [notice,setNotice] = useState<{error:boolean;text:string}|null>(null)
  const [preview,setPreview] = useState('')
  const [tested,setTested] = useState<Record<string,boolean>>({})
  const [credentials,setCredentials] = useState({ environment:'test', username:'',password:'',clientId:'',clientSecret:'' })
  const fileInput = useRef<HTMLInputElement>(null)
  const operationPending = useRef(false)
  async function refresh() {
    const response = await fetch('/api/accounting/integrations', {cache:'no-store'})
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Conexiunile nu au putut fi încărcate.')
    setOverview(result)
  }
  useEffect(() => { refresh().catch(error => setNotice({error:true,text:error.message})) }, [])
  async function run(body:Record<string,unknown>) {
    if (operationPending.current) return
    operationPending.current = true
    setBusy(true); setNotice(null); setPreview('')
    if (body.connectionTest) setTested(current => ({...current,[String(body.service)]:false}))
    try {
      const response = await fetch('/api/accounting/integrations', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Operațiunea nu a putut fi finalizată.')
      setNotice({error:result.accepted === false,text:result.message + (result.httpStatus ? ` HTTP ${result.httpStatus}.` : '')})
      setPreview(result.preview || '')
      if (body.operation === 'configureReges' || body.operation === 'disconnectReges') {
        setTested(current => ({...current,REGES:false}))
        setCredentials(current => ({...current,password:'',clientSecret:''}))
      }
      if (body.connectionTest) setTested(current => ({...current,[String(body.service)]:result.accepted === true}))
      await refresh()
    } catch(error) { setNotice({error:true,text:error instanceof Error ? error.message : 'Conexiunea a eșuat.'}) }
    finally { operationPending.current=false; setBusy(false) }
  }
  const connection = overview?.connections.find(value => value.service === 'REGES')
  const isReges = service === 'REGES'
  const environment = isReges ? connection?.environment : overview?.anaf.environment
  const ready = isReges ? Boolean(connection) : Boolean(overview?.anaf.configured && overview.anaf.connected && overview.firm.cif)
  const queueBlocked=overview?.queue?.some(value => value.environment===environment && value.state!=='idle')
  function resetFile() { setXml('');setFileName('');setRequestId('');if(fileInput.current)fileInput.current.value='' }
  function selectService(value:string) {setService(value);setPreview('');setNotice(null);setReference('');resetFile()}
  async function selectFile(file?:File) {
    resetFile()
    if (!file) return
    if (file.size>2_000_000) {setNotice({error:true,text:'Fișierul trebuie să fie mai mic de 2 MB.'});return}
    try {setXml(await file.text());setFileName(file.name);setRequestId(crypto.randomUUID())}
    catch {setNotice({error:true,text:'Fișierul nu a putut fi citit.'})}
  }
  return <div className="institutions-workspace">
    <div className="page-head"><div><div className="eyebrow">Conexiuni fiscale și evidența salariaților</div><h1 className="page-title">Integrări instituții</h1><p className="page-subtitle">{overview?.firm.name || 'Elmont S.A.'}{overview?.firm.cif ? ` · CUI ${overview.firm.cif}` : ''}</p></div><button className="btn-secondary" disabled={busy} onClick={() => refresh().catch(error => setNotice({error:true,text:error.message}))}><RefreshCw size={15}/> Actualizează</button></div>
    <div className="institutions-services" aria-label="Selectează serviciul">
      {[{id:'ETRANSPORT',name:'RO e-Transport',description:'Transporturi, stări și răspunsuri ANAF',icon:Truck,configured:overview?.anaf.configured && overview.anaf.connected,env:overview?.anaf.environment},{id:'REGES',name:'REGES Online',description:'Salariați, contracte și registrul angajatorului',icon:Users,configured:Boolean(connection),env:connection?.environment}].map(item => <button type="button" key={item.id} className={`institution-service ${service===item.id?'is-selected':''}`} aria-pressed={service===item.id} disabled={busy} onClick={() => selectService(item.id)}><span className="institution-icon"><item.icon size={21}/></span><span className="institution-service-copy"><strong>{item.name}</strong><small>{item.description}</small><span className="institution-service-state">{tested[item.id] ? <><CheckCircle2 size={13}/> Verificat prin API</> : item.configured ? <><Link2 size={13}/> Configurat · de verificat</> : <><TriangleAlert size={13}/> Conexiune necesară</>}</span></span><span className={`institution-env ${item.env==='production'?'is-production':''}`}>{environmentLabel(item.env)}</span></button>)}
    </div>
    <div className="institution-context"><ShieldCheck size={17}/><p>{environment==='test' ? 'Mediu oficial de test. Cererile ajung la API-ul de test al instituției și necesită autorizare.' : environment==='production' ? 'Mediu de producție. Transmiterile ajung în sistemul real al instituției.' : 'Configurează conexiunea pentru a accesa serviciul.'}</p>{!isReges && <a href="/dashboard/contabilitate/efactura">Conexiune ANAF <ArrowRight size={14}/></a>}</div>
    {notice && <div className={`institution-notice ${notice.error?'is-error':''}`} role={notice.error?'alert':'status'}>{notice.error?<TriangleAlert size={17}/>:<CheckCircle2 size={17}/>}<span>{notice.text}</span></div>}
    <div className="institutions-operations">
      <section className="card institution-panel"><div className="institution-panel-heading"><span className="institution-icon"><CloudCog size={18}/></span><div><h2>Consultă serviciul</h2><p>Verifică accesul și urmărește răspunsurile.</p></div></div>
        {!ready && <p className="institution-empty">{isReges?'Completează credențialele REGES mai jos.':'Conectează ANAF și completează CUI-ul firmei pentru a testa e-Transport.'}</p>}
        <button disabled={busy || !ready} className="btn-secondary institution-wide" onClick={() => run({service,action:isReges?'profile':'list',days:30,connectionTest:true})}><ShieldCheck size={15}/> Testează conexiunea</button>
        {!isReges ? <div className="institution-lookup"><label className="field-label" htmlFor="institution-reference">Identificator încărcare / descărcare</label><input id="institution-reference" className="input" value={reference} placeholder="Identificatorul returnat de ANAF" inputMode="numeric" onChange={event => setReference(event.target.value)}/><div className="institution-actions"><button disabled={busy || !ready || !reference} className="btn-secondary" onClick={() => run({service,action:'status',reference})}><RefreshCw size={14}/> Verifică starea</button><button disabled={busy || !ready || !reference} className="btn-secondary" onClick={() => run({service,action:'download',reference})}><Download size={14}/> Preia răspunsul</button></div><button disabled={busy || !ready} className="institution-text-action" onClick={() => run({service,action:'list',days:30})}>Vezi mesajele din ultimele 30 de zile <ArrowRight size={14}/></button></div> : <div className="institution-lookup"><button disabled={busy || !ready || queueBlocked} className="btn-secondary institution-wide" onClick={() => run({service,action:'read'})}><Download size={15}/> Preia următorul răspuns</button><p className="institution-help">Fiecare rezultat este arhivat înainte de confirmarea citirii. Elmont are propria poziție în coadă.</p>{queueBlocked && <p role="alert" className="institution-notice is-error">Confirmarea citirii anterioare este incertă. Arhiva este păstrată; contactează suportul pentru verificarea poziției în coadă.</p>}</div>}
      </section>
      <section className="card institution-panel"><div className="institution-panel-heading"><span className="institution-icon"><FileUp size={18}/></span><div><h2>Transmite un document</h2><p>Încarcă XML-ul în structura oficială {isReges?'REGES':'e-Transport'}.</p></div></div>
        <form onSubmit={event => {event.preventDefault();if(window.confirm(`Transmiți ${fileName} către ${isReges?'REGES':'ANAF e-Transport'}, în mediul ${environmentLabel(environment)}, pentru ${overview?.firm.name}?`))void run({service,action:'upload',entity,xml,requestId})}}>
          {isReges && <label className="field-label" htmlFor="institution-entity">Tip document<select id="institution-entity" className="input" value={entity} disabled={busy} onChange={event => {setEntity(event.target.value);resetFile()}}><option value="Salariat">Salariat</option><option value="Contract">Contract</option><option value="PropunereDetasareContract">Propunere de detașare</option><option value="PropunereMutareContract">Propunere de mutare</option></select></label>}
          <label className="institution-upload" htmlFor="institution-file"><FileUp size={25}/><strong>{fileName || 'Alege un fișier XML'}</strong><span>{fileName?'Fișier pregătit pentru transmitere':'XML · maximum 2 MB'}</span><input ref={fileInput} id="institution-file" type="file" accept=".xml,application/xml,text/xml" disabled={busy} onChange={event => void selectFile(event.target.files?.[0])}/></label>
          {fileName && <button type="button" className="institution-text-action" onClick={resetFile} disabled={busy}><X size={13}/> Elimină fișierul</button>}
          <p className="institution-help">Validarea finală aparține instituției. După transmitere, verifică răspunsul și rezultatul procesării.</p>
          <button className="btn-primary institution-wide" disabled={busy || !xml || !ready}>{busy?<RefreshCw className="animate-spin" size={15}/>:<FileUp size={15}/>} {busy?'Se procesează…':'Transmite documentul'}</button>
        </form>
      </section>
    </div>
    {isReges && <details className="card institution-connection"><summary><Link2 size={16}/><strong>Configurare REGES</strong><span>{connection?'Credențiale salvate pentru firmă':'Completează accesul extern'}</span></summary><form className="institution-connection-form" onSubmit={event => {event.preventDefault();void run({operation:'configureReges',credentials})}}><label className="field-label">Mediu<select className="input" value={credentials.environment} onChange={event => setCredentials({...credentials,environment:event.target.value})}><option value="test">Test oficial</option><option value="production">Producție</option></select></label>{([{key:'username',label:'Utilizator API',secret:false},{key:'password',label:'Parolă API',secret:true},{key:'clientId',label:'Client ID',secret:false},{key:'clientSecret',label:'Client secret',secret:true}] as const).map(field => <label key={field.key} className="field-label">{field.label} *<input type={field.secret?'password':'text'} autoComplete={field.secret?'new-password':'off'} className="input" required value={credentials[field.key]} onChange={event => setCredentials({...credentials,[field.key]:event.target.value})}/></label>)}<p className="institution-help">Selectează registrul firmei în REGES, apoi generează credențialele din Setări angajator → Utile → Acces sistem extern. ID-urile utilizatorului și angajatorului sunt identificatori separați, nu parole. Pentru test folosește credențialele mediului de test.</p><div className="institution-actions"><button disabled={busy} className="btn-primary">Salvează conexiunea</button>{connection && <button type="button" disabled={busy} className="btn-secondary" onClick={() => run({operation:'disconnectReges'})}>Deconectează</button>}</div></form></details>}
    {isReges && <RegesNomenclatures/>}
    {preview && <section className="card institution-response"><div className="institution-panel-heading"><h2>Răspuns API</h2><button className="institution-text-action" onClick={() => setPreview('')}><X size={14}/> Închide</button></div><pre>{preview}</pre></section>}
    <section className="institution-history"><div className="institution-panel-heading"><div><h2>Istoricul răspunsurilor</h2><p>Documente arhivate pentru Elmont.</p></div><span className="institution-count">{overview?.exchanges.length || 0} răspunsuri recente</span></div><div className="card-table"><table><thead><tr><th>Data</th><th>Serviciu</th><th>Mediu</th><th>Operațiune</th><th>Răspuns</th><th>Document</th></tr></thead><tbody>{!overview?.exchanges.length && <tr><td colSpan={6} className="empty-row">Niciun răspuns arhivat. Testează conexiunea sau transmite un document.</td></tr>}{overview?.exchanges.map(row => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})}</td><td>{row.service==='REGES'?'REGES Online':'RO e-Transport'}</td><td><span className={`institution-env ${row.environment==='production'?'is-production':''}`}>{environmentLabel(row.environment)}</span></td><td>{actionLabels[row.action] || row.action}</td><td><span className={`institution-http ${row.httpStatus>=200&&row.httpStatus<300?'is-ok':''}`}>{row.httpStatus?`HTTP ${row.httpStatus}`:'De verificat la instituție'}</span>{row.service==='REGES' && <RegesResponseDetails row={row}/>}</td><td>{row.httpStatus?<a className="link-action" href={`/api/accounting/integrations?download=${row.id}`}><Download size={13}/> Descarcă</a>:'În așteptare'}</td></tr>)}</tbody></table></div></section>
  </div>
}
