'use client'

import { useMemo, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { BarChart3, Building2, CheckCircle2, ChevronDown, ChevronUp, Eye, FileText, Link2, LoaderCircle, MessageCircle, Pencil, Plus, Printer, Save, Search, Trash2, UploadCloud } from 'lucide-react'
import { ProjectProgressList } from '@/components/projects/project-progress-list'
import { useRouter } from 'next/navigation'

type ApprovalStatus = 'REQUIRED' | 'SUBMITTED' | 'OBTAINED' | 'NOT_REQUIRED'
type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED'
type Approval = { id:string; name:string; institution:string|null; status:ApprovalStatus; documentUrl:string|null; documentName:string|null }
type Project = { id:string; name:string; certificateNumber:string|null; certificateDate:string|null; beneficiary:string|null; beneficiaryPhone:string|null; address:string|null; description:string|null; status:ProjectStatus; constructionAuthorizationStatus:ApprovalStatus; documentUrl:string|null; documentName:string|null; updatedAt:string; approvals:Approval[] }

const PROJECT_LABELS:Record<ProjectStatus,string> = { ACTIVE:'În lucru', ON_HOLD:'În așteptare', COMPLETED:'Finalizat', ARCHIVED:'Arhivat' }
const STAGE_LABELS:Record<ApprovalStatus,string> = { REQUIRED:'Stadiu incipient', SUBMITTED:'Depus', OBTAINED:'Obținut', NOT_REQUIRED:'Nu este necesar' }
const STAGE_CLASSES:Record<ApprovalStatus,string> = { REQUIRED:'bg-slate-200 text-slate-700 border-slate-300', SUBMITTED:'bg-amber-400 text-amber-950 border-amber-400', OBTAINED:'bg-emerald-500 text-white border-emerald-500', NOT_REQUIRED:'bg-slate-200 text-slate-500 border-slate-200' }
const AUTHORIZATION_CLASSES:Record<ApprovalStatus,string> = { REQUIRED:'bg-slate-100 text-slate-500 border-slate-200', SUBMITTED:'bg-blue-600 text-white border-blue-600', OBTAINED:'bg-emerald-600 text-white border-emerald-600', NOT_REQUIRED:'bg-slate-100 text-slate-500 border-slate-200' }
const STANDARD_APPROVALS = ['MEDIU', 'APĂ', 'GAZ', 'TELEFON', 'ENERGIE ELECTRICĂ', 'CANALIZARE', 'SALUBRITATE', 'ISU', 'DRUMURI', 'CULTURĂ']

function stageScore(status:ApprovalStatus){ return status === 'OBTAINED' ? 1 : status === 'SUBMITTED' ? .5 : 0 }
function nextStage(status:ApprovalStatus):ApprovalStatus { return status === 'REQUIRED' || status === 'NOT_REQUIRED' ? 'SUBMITTED' : status === 'SUBMITTED' ? 'OBTAINED' : 'REQUIRED' }
function progressColor(progress:number){
  if(progress>=100)return '#16a34a'
  const hue=Math.round(Math.max(0,Math.min(99,progress))*.55)
  return 'hsl('+hue+' 82% 50%)'
}
function projectProgressColor(project:Project){
  if(project.constructionAuthorizationStatus==='OBTAINED')return '#16a34a'
  if(project.constructionAuthorizationStatus==='SUBMITTED')return '#2563eb'
  return progressColor(projectProgress(project))
}
function projectProgress(project:Project){
  const approvalScore=project.approvals.length?project.approvals.reduce((sum,item)=>sum+stageScore(item.status),0)/project.approvals.length:0
  return Math.round(approvalScore*70+stageScore(project.constructionAuthorizationStatus)*30)
}
const day = (value:string|null) => value?.slice(0,10) || ''

export function ProjectsManager({ initialProjects }: { initialProjects:Project[] }) {
  const router = useRouter()
  const [filter,setFilter] = useState<'ALL'|ProjectStatus>('ALL')
  const [query,setQuery] = useState('')
  const [expanded,setExpanded] = useState<string|null>(null)
  const [modal,setModal] = useState<Project|'new'|null>(null)
  const [certificateFile,setCertificateFile] = useState<File|null>(null)
  const [busy,setBusy] = useState(false)
  const [editing,setEditing] = useState(false)
  const [sendingProjectId,setSendingProjectId] = useState<string|null>(null)

  const visible = useMemo(() => initialProjects.filter(project => (filter === 'ALL' || project.status === filter) && (!query || [project.name,project.beneficiary,project.beneficiaryPhone,project.address].some(value => value?.toLowerCase().includes(query.toLowerCase())))), [initialProjects,filter,query])
  const chart = initialProjects.filter(project => project.status !== 'ARCHIVED').map(project => ({ id:project.id, name:project.name, progress:projectProgress(project), authorizationStatus:project.constructionAuthorizationStatus }))
  const allApprovals = initialProjects.flatMap(project => project.approvals)

  async function api(url:string,method:string,data?:unknown){
    const response = await fetch(url,{method,headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined})
    if(!response.ok){ const body=await response.json().catch(()=>({})); throw new Error(body.error || 'Operațiunea nu a putut fi salvată.') }
    return response
  }
  async function attachCertificate(projectId:string,file:File){
    const blob=await upload('projects/'+projectId+'/certificate/'+file.name,file,{access:'private',handleUploadUrl:'/api/projects/upload'})
    await api('/api/projects/'+projectId,'PATCH',{documentUrl:blob.pathname,documentName:file.name})
  }
  async function createProject(form:FormData){
    setBusy(true)
    try{
      const approvals=[...form.getAll('standardApproval'),...form.getAll('customApproval')].map(String).map(name=>name.trim()).filter(Boolean).map(name=>({name}))
      const payload:any=Object.fromEntries(form); delete payload.standardApproval; delete payload.customApproval
      const response=await api('/api/projects','POST',{...payload,approvals}); const project=await response.json()
      let warning=''
      if(certificateFile){ try{ await attachCertificate(project.id,certificateFile) }catch{ warning='Proiectul a fost salvat, dar certificatul nu a putut fi atașat.' } }
      closeModal(); router.refresh(); if(warning) alert(warning)
    } catch(error){ alert(error instanceof Error?error.message:'Proiectul nu a putut fi salvat.') } finally { setBusy(false) }
  }
  async function sendWhatsAppSummary(project:Project){
    if(!project.beneficiaryPhone)return
    if(!confirm(`Trimiți beneficiarului actualizarea proiectului pe WhatsApp la ${project.beneficiaryPhone}?`))return
    setSendingProjectId(project.id)
    try{
      const response=await api(`/api/projects/${project.id}/send-whatsapp`,'POST')
      const result=await response.json()
      if(result.sent){ alert('Actualizarea proiectului a fost trimisă pe WhatsApp.') }
      else if(result.fallbackUrl){
        if(confirm(`${result.message||'Canalul WhatsApp Business nu este configurat.'}\n\nDeschizi WhatsApp cu mesajul completat pentru trimitere manuală?`)) window.open(result.fallbackUrl,'_blank','noopener,noreferrer')
      }
    }catch(error){alert(error instanceof Error?error.message:'Mesajul nu a putut fi pregătit.')}
    finally{setSendingProjectId(null)}
  }
  async function patchProject(id:string,data:unknown){ try{await api('/api/projects/'+id,'PATCH',data);router.refresh()}catch(error){alert((error as Error).message)} }
  async function deleteProject(project:Project){ if(!confirm(`Ștergi proiectul „${project.name}” și toate avizele?`))return;await api('/api/projects/'+project.id,'DELETE');router.refresh() }
  async function addApproval(projectId:string,form:FormData){ try{await api(`/api/projects/${projectId}/approvals`,'POST',Object.fromEntries(form));router.refresh()}catch(error){alert((error as Error).message)} }
  async function patchApproval(projectId:string,approvalId:string,data:unknown){ try{await api(`/api/projects/${projectId}/approvals/${approvalId}`,'PATCH',data);router.refresh()}catch(error){alert((error as Error).message)} }
  async function deleteApproval(projectId:string,approvalId:string){ if(!confirm('Ștergi acest aviz?'))return;await api(`/api/projects/${projectId}/approvals/${approvalId}`,'DELETE');router.refresh() }
  async function attachApproval(projectId:string,approvalId:string,file:File){ try{const blob=await upload(`projects/${projectId}/approvals/${file.name}`,file,{access:'private',handleUploadUrl:'/api/projects/upload'});await patchApproval(projectId,approvalId,{documentUrl:blob.pathname,documentName:file.name})}catch{alert('Avizul scanat nu a putut fi încărcat.')} }
  function closeModal(){ setModal(null); setCertificateFile(null) }

  return <div>
    <header className="screen-only flex flex-wrap items-end justify-between gap-4 mb-6"><div><h1 className="text-2xl font-semibold">Proiecte</h1><p className="text-xs text-slate-500 mt-1">Gestiunea avizelor și a autorizațiilor de construire.</p></div><div className="flex items-center gap-2"><button className="btn-secondary inline-flex items-center gap-2" onClick={()=>window.print()}><Printer size={17}/> Printează</button><button className={editing?'btn-primary inline-flex items-center gap-2':'btn-secondary inline-flex items-center gap-2'} onClick={()=>{setEditing(value=>!value);setModal(null)}}>{editing?<><Eye size={17}/> Închide editarea</>:<><Pencil size={17}/> Mod editare</>}</button>{editing&&<button className="btn-primary inline-flex items-center gap-2" onClick={()=>setModal('new')}><Plus size={17}/> Adaugă proiect</button>}</div></header>
    <section className="print-only">
      <div className="mb-5 border-b border-slate-300 pb-3"><h1 className="text-xl font-bold">RAPORT PROIECTE</h1><p className="text-xs text-slate-500">Generat la {new Date().toLocaleDateString('ro-RO')}</p></div>
      <div className="grid xl:grid-cols-2 gap-3">{visible.map(project=><article key={project.id} className="border border-slate-300 rounded-xl p-4 break-inside-avoid"><div className="flex justify-between gap-4"><div><h2 className="font-bold">{project.name}</h2><p className="text-xs text-slate-600">{project.beneficiary||'Beneficiar nespecificat'}{project.beneficiaryPhone?' · '+project.beneficiaryPhone:''}{project.address?' · '+project.address:''}</p></div><strong>{projectProgress(project)}%</strong></div><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">{project.approvals.map(approval=><div key={approval.id} className="flex justify-between border-b border-slate-200 py-1"><span>{approval.name}</span><b>{STAGE_LABELS[approval.status]}</b></div>)}</div><p className="mt-3 text-xs font-bold">Autorizația de construire: {STAGE_LABELS[project.constructionAuthorizationStatus]}</p></article>)}</div>
    </section>
    <div className="screen-only">
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5"><Stat icon={<Building2/>} label="Proiecte în lucru" value={initialProjects.filter(p=>p.status==='ACTIVE').length}/><Stat icon={<CheckCircle2/>} label="Avize obținute" value={allApprovals.filter(a=>a.status==='OBTAINED').length}/><Stat icon={<FileText/>} label="Avize depuse" value={allApprovals.filter(a=>a.status==='SUBMITTED').length}/><Stat icon={<BarChart3/>} label="Progres mediu" value={(chart.length?Math.round(chart.reduce((sum,p)=>sum+p.progress,0)/chart.length):0)+'%'}/></div>
    {chart.length>0 && <section className="card p-5 mb-5"><h2 className="font-semibold">Stadiul fizic al proiectelor</h2><p className="text-xs text-slate-500 mb-4">Fiecare rând reprezintă un singur proiect · albastru = autorizație depusă · verde = autorizație obținută</p><ProjectProgressList projects={chart}/></section>}
    <div className="flex flex-wrap gap-2 mb-4"><div className="calendar-search !ml-0"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Caută proiect, beneficiar…"/></div>{(['ALL','ACTIVE','ON_HOLD','COMPLETED','ARCHIVED'] as const).map(value=><button key={value} onClick={()=>setFilter(value)} className={filter===value?'btn-primary':'btn-secondary'}>{value==='ALL'?'Toate':PROJECT_LABELS[value]}</button>)}</div>
    <div className="grid xl:grid-cols-2 gap-3">
      {visible.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          editing={editing}
          open={expanded === project.id}
          toggle={() => setExpanded(expanded === project.id ? null : project.id)}
          patchProject={patchProject}
          deleteProject={deleteProject}
          edit={() => setModal(project)}
          addApproval={addApproval}
          patchApproval={patchApproval}
          deleteApproval={deleteApproval}
          attachApproval={attachApproval}
          sendUpdate={sendWhatsAppSummary}
          sending={sendingProjectId===project.id}
          attachCertificate={async (file: File) => {
            try {
              await attachCertificate(project.id, file)
              router.refresh()
            } catch {
              alert('Certificatul nu a putut fi incarcat.')
            }
          }}
        />
      ))}
      {!visible.length && <div className="card p-12 text-center text-slate-500">Nu exista proiecte pentru filtrul selectat.</div>}
    </div>
    {modal && <ProjectModal mode={modal} busy={busy} onClose={closeModal} onCertificate={setCertificateFile} onCreate={createProject} onPatch={async(data:any)=>{await patchProject((modal as Project).id,data);closeModal()}}/>}
    </div>
  </div>
}

function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:string|number}){return <div className="card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">{icon}</div><div><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-semibold">{value}</p></div></div>}

function ProjectCard({project,editing,open,toggle,patchProject,deleteProject,edit,addApproval,patchApproval,deleteApproval,attachApproval,attachCertificate,sendUpdate,sending}:any){
  const progress=projectProgress(project)
  const finished=project.constructionAuthorizationStatus==='OBTAINED'||project.status==='COMPLETED'
  const allObtained=project.approvals.length>0&&project.approvals.every((item:Approval)=>item.status==='OBTAINED')
  const authorizationClass=allObtained?AUTHORIZATION_CLASSES[project.constructionAuthorizationStatus as ApprovalStatus]:'bg-slate-100 border-slate-200 text-slate-400'
  return <article className={`card overflow-hidden ${open ? 'xl:col-span-2' : ''}`}>
    <div className="px-4 py-3.5">
      <div className="flex flex-wrap gap-3 justify-between">
        <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold leading-snug">{project.name}</h2><span className={`text-xs rounded-full px-2.5 py-1 inline-flex items-center gap-1 ${finished?'bg-emerald-50 text-emerald-700':'bg-blue-50 text-blue-700'}`}>{finished&&<CheckCircle2 size={12}/>} {finished?'Finalizat':PROJECT_LABELS[project.status as ProjectStatus]}</span></div><p className="text-xs text-slate-500 mt-1">{project.beneficiary||'Beneficiar nespecificat'}{project.beneficiaryPhone?' · '+project.beneficiaryPhone:''}{project.address?' · '+project.address:''}</p><p className="text-xs text-slate-400 mt-1">{project.certificateNumber?'CU '+project.certificateNumber:''}{project.certificateDate?' din '+new Date(project.certificateDate).toLocaleDateString('ro-RO'):''}</p></div>
        <div className="flex flex-wrap items-center gap-1.5">{project.beneficiaryPhone&&<button className="round-action !w-8 !h-8 text-emerald-600" onClick={()=>sendUpdate(project)} disabled={sending} title="Trimite actualizarea pe WhatsApp">{sending?<LoaderCircle className="animate-spin" size={15}/>:<MessageCircle size={15}/>}</button>}{editing&&<><select className="input-field !py-2" value={project.status} onChange={event=>patchProject(project.id,{status:event.target.value})}>{Object.entries(PROJECT_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className="round-action !w-8 !h-8" onClick={edit} title="Editează proiectul"><Pencil size={15}/></button><button className="round-action !w-8 !h-8 text-rose-600" onClick={()=>deleteProject(project)} title="Șterge proiectul"><Trash2 size={15}/></button></>}<button className="round-action !w-8 !h-8 text-blue-700" onClick={toggle} title={open?'Restrânge':'Vezi detaliile'}>{open?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button></div>
      </div>
      <div className="mt-2.5 flex items-center gap-2"><div className="h-2.5 flex-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full transition-all" style={{width:progress+'%',background:projectProgressColor(project)}}/></div><strong className="text-sm text-blue-700">{progress}%</strong></div>
      <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-500"><span>{project.approvals.length} avize</span><span>{project.approvals.filter((approval:Approval)=>approval.status==='OBTAINED').length} obținute</span>{project.documentUrl?<a href={`/api/projects/${project.id}/document`} target="_blank" className="text-blue-700 font-semibold">Deschide certificatul</a>:editing?<label className="text-blue-700 font-semibold cursor-pointer inline-flex gap-1 items-center"><UploadCloud size={13}/> Încarcă certificatul<input type="file" accept="application/pdf" className="hidden" onChange={event=>event.target.files?.[0]&&attachCertificate(event.target.files[0])}/></label>:null}</div>
    </div>
    {open&&<div className="border-t bg-slate-50/60 p-4">
      <p className="text-xs font-bold tracking-wider text-slate-500 mb-3">{editing?'AVIZELE PROIECTULUI · CLICK PE CULOARE PENTRU SCHIMBAREA STĂRII':'STADIUL AVIZELOR PROIECTULUI'}</p>
      <div className="flex flex-wrap gap-3">{project.approvals.map((approval:Approval)=><div key={approval.id} className="border border-slate-200 rounded-xl bg-white p-1.5 flex items-center gap-2"><button disabled={!editing} onClick={()=>editing&&patchApproval(project.id,approval.id,{status:nextStage(approval.status)})} className={`min-h-10 rounded-lg border px-3 text-left ${editing?'cursor-pointer':'cursor-default'} ${STAGE_CLASSES[approval.status]}`}><span className="block text-sm font-extrabold">{approval.name}</span><span className="block text-[10px] uppercase tracking-wide opacity-80">{STAGE_LABELS[approval.status]}</span></button>{approval.documentUrl?<a href={`/api/projects/${project.id}/approvals/${approval.id}/document`} target="_blank" className="round-action text-blue-700" title="Deschide avizul"><Link2 size={14}/></a>:editing?<label className="round-action text-blue-700 cursor-pointer" title="Încarcă avizul scanat"><UploadCloud size={14}/><input type="file" accept="application/pdf" className="hidden" onChange={event=>event.target.files?.[0]&&attachApproval(project.id,approval.id,event.target.files[0])}/></label>:null}{editing&&approval.name.trim().toUpperCase()!=='MEDIU'&&<button className="text-rose-500 p-1" onClick={()=>deleteApproval(project.id,approval.id)} title="Șterge avizul"><Trash2 size={14}/></button>}</div>)}</div>
      {editing&&<form action={(form)=>addApproval(project.id,form)} className="flex flex-wrap gap-2 mt-4"><input name="name" className="input-field flex-1 min-w-56" placeholder="Alt aviz necesar" required/><input name="institution" className="input-field flex-1 min-w-48" placeholder="Instituție (opțional)"/><button className="btn-secondary inline-flex gap-2 items-center"><Plus size={15}/> Adaugă aviz</button></form>}
      <div className="mt-6 pt-5 border-t border-slate-200"><button disabled={!editing||!allObtained} onClick={()=>{if(!editing||!allObtained)return;const next=nextStage(project.constructionAuthorizationStatus as ApprovalStatus);patchProject(project.id,{constructionAuthorizationStatus:next,...(next==='OBTAINED'?{status:'COMPLETED'}:project.status==='COMPLETED'?{status:'ACTIVE'}:{})})}} className={`w-full min-h-20 rounded-2xl border-2 px-5 text-center transition ${editing&&allObtained?'cursor-pointer':'cursor-default'} ${authorizationClass}`}><span className="flex items-center justify-center gap-2 text-base font-black tracking-wide">{project.constructionAuthorizationStatus==='OBTAINED'&&<CheckCircle2 size={19}/>} AUTORIZAȚIA DE CONSTRUIRE</span><span className="block text-xs uppercase mt-1">{allObtained?STAGE_LABELS[project.constructionAuthorizationStatus as ApprovalStatus]:'Disponibilă după obținerea tuturor avizelor'}</span></button></div>
    </div>}
  </article>
}
function ProjectModal({mode,busy,onClose,onCertificate,onCreate,onPatch}:any){
  const project=mode==='new'?null:mode; const [custom,setCustom]=useState<string[]>([]); const [customValue,setCustomValue]=useState('')
  function addCustom(){const value=customValue.trim();if(value&&!custom.includes(value)){setCustom([...custom,value]);setCustomValue('')}}
  return <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onMouseDown={onClose}><form action={mode==='new'?onCreate:(form=>onPatch(Object.fromEntries(form)))} onMouseDown={event=>event.stopPropagation()} className="bg-white rounded-3xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto"><h2 className="text-xl font-semibold">{mode==='new'?'Adaugă proiect':'Editează proiectul'}</h2><div className="grid sm:grid-cols-2 gap-3 mt-5"><Field span label="Numele proiectului" name="name" value={project?.name}/><Field label="Număr certificat" name="certificateNumber" value={project?.certificateNumber}/><Field label="Data certificatului" name="certificateDate" type="date" value={day(project?.certificateDate||null)}/><Field label="Beneficiar" name="beneficiary" value={project?.beneficiary}/><Field label="Telefon beneficiar" name="beneficiaryPhone" type="tel" value={project?.beneficiaryPhone}/><Field span label="Amplasament / adresă" name="address" value={project?.address}/><label className="sm:col-span-2 text-xs font-semibold text-slate-500">Descriere<textarea name="description" className="input-field w-full min-h-20 mt-1" defaultValue={project?.description||''}/></label></div>
  {mode==='new'&&<><div className="mt-5"><p className="text-sm font-semibold">Avize standard</p><p className="text-xs text-slate-500 mb-2">Selectează numai avizele necesare proiectului.</p><div className="flex flex-wrap gap-2"><input type="hidden" name="standardApproval" value="MEDIU"/><span className="inline-flex px-3 py-2 rounded-xl border border-slate-300 bg-slate-200 text-slate-700 text-xs font-bold">MEDIU · obligatoriu</span>{STANDARD_APPROVALS.filter(name=>name!=='MEDIU').map(name=><label key={name} className="cursor-pointer"><input type="checkbox" name="standardApproval" value={name} className="peer sr-only"/><span className="inline-flex px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600">{name}</span></label>)}</div></div><div className="mt-4"><p className="text-sm font-semibold mb-2">Alte avize</p><div className="flex gap-2"><input value={customValue} onChange={event=>setCustomValue(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addCustom()}}} className="input-field flex-1" placeholder="Scrie denumirea avizului"/><button type="button" className="btn-secondary inline-flex items-center gap-1" onClick={addCustom}><Plus size={15}/> Adaugă</button></div><div className="flex flex-wrap gap-2 mt-2">{custom.map(name=><span key={name} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold">{name}<button type="button" onClick={()=>setCustom(custom.filter(item=>item!==name))}>×</button><input type="hidden" name="customApproval" value={name}/></span>)}</div></div><label className="mt-5 border border-dashed border-blue-200 rounded-2xl p-4 flex items-center gap-3 cursor-pointer"><UploadCloud className="text-blue-600"/><span><b className="block text-sm">Certificat de urbanism PDF - opțional</b><small className="text-slate-500">Fișierul rămâne atașat proiectului în platformă.</small></span><input type="file" accept="application/pdf" className="hidden" onChange={event=>onCertificate(event.target.files?.[0]||null)}/></label></>}
  <div className="flex justify-end gap-2 mt-6"><button type="button" className="btn-secondary" onClick={onClose}>Renunță</button><button className="round-action bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" disabled={busy} aria-label="Salveaza proiectul" title={busy?'Se salveaza...':'Salveaza proiectul'}><Save size={17}/></button></div></form></div>
}
function Field({label,name,value,type='text',span=false}:any){return <label className={`${span?'sm:col-span-2 ':''}text-xs font-semibold text-slate-500`}>{label}<input name={name} type={type} className="input-field w-full mt-1" defaultValue={value||''} required={name==='name'}/></label>}
