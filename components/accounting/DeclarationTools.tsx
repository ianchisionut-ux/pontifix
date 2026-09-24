"use client";
import { useEffect,useState } from "react";
type Journal={warning:string;blockers:string[];outputVat:number;inputVat:number;rows:Array<{direction:string;documentId:number;reference:string;partner:string;date:string;paymentId:number;rate:number;base:number;vat:number;deductibleVat:number}>;balances:Array<{direction:string;documentId:number;reference:string;rate:number;openingVat:number;closingVat:number}>};
const money=(n:number)=>n.toLocaleString('ro-RO',{minimumFractionDigits:2,maximumFractionDigits:2});
export function DeclarationTools({year,month}:{year:number;month:number}){
  const [journal,setJournal]=useState<Journal|null>(null),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false);
  const [preview,setPreview]=useState<{ready:boolean;blockers:string[];operationCount:number}|null>(null),[previewError,setPreviewError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setJournal(null);setError('');
    fetch(`/api/accounting/declarations/cash-vat?year=${year}&month=${month}`,{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}).then(setJournal).catch(e=>{if(!controller.signal.aborted)setError(e.message||'Jurnal indisponibil.');});
    return()=>controller.abort();
  },[year,month]);
  useEffect(()=>{
    const controller=new AbortController();setPreview(null);setPreviewError('');
    fetch(`/api/accounting/declarations/d394?year=${year}&month=${month}&confirmed=${confirmed?1:0}`,{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}).then(setPreview).catch(e=>{if(!controller.signal.aborted)setPreviewError(e.message||'Prevalidare indisponibilă.');});
    return()=>controller.abort();
  },[year,month,confirmed]);
  return <>
    <section className="card p-4 mb-5"><h3 className="font-bold">XML D394 — facturi interne standard B2B</h3>
      <p>Export limitat la parteneri plătitori TVA, regim normal și cote 11%/21%. Cazurile nesuportate blochează întregul export. Fișierul necesită validare în Soft J ANAF înainte de semnare și depunere.</p>
      <label className="field-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confirm că am verificat perioada: numai facturi interne standard B2B, fără bonuri/AMEF, operațiuni în alte sisteme, facturi simplificate, produse cu raportare specială, operațiuni imobiliare sau regimuri speciale.</label>
      {previewError&&<p role="alert">{previewError}</p>}
      {!preview&&!previewError&&<p>Se verifică documentele…</p>}
      {preview&&<><div className="declaration-blockers">{preview.blockers.map(b=><span key={b}>{b}</span>)}</div>{preview.ready?<a className="btn-primary" href={`/api/accounting/declarations/xml?type=D394&year=${year}&month=${month}&confirmed=1`}>Descarcă XML D394 ({preview.operationCount} grupuri)</a>:<p>XML D394 blocat — rezolvă verificările de mai sus.</p>}</>}
    </section>
    <section className="card p-4 mb-5"><h3 className="font-bold">Jurnal TVA la încasare — control lunar</h3>
      {error&&<p role="alert">{error}</p>}{!journal&&!error&&<p>Se calculează jurnalul…</p>}
      {journal&&<><p>{journal.warning}</p><p>TVA încasată alocată: {money(journal.outputVat)} RON · TVA deductibilă din plăți: {money(journal.inputVat)} RON</p>
        <div className="declaration-blockers">{journal.blockers.map(b=><span key={b}>{b}</span>)}</div>
        <div className="card-table"><table><thead><tr><th>Sens</th><th>Document / partener</th><th>Data plății</th><th>Cotă</th><th>Bază RON</th><th>TVA RON</th><th>Deductibil RON</th></tr></thead><tbody>
          {journal.rows.map((r,i)=><tr key={`${r.direction}:${r.documentId}:${r.paymentId}:${i}`}><td>{r.direction==='SALE'?'Încasare':'Plată'}</td><td>{r.reference} — {r.partner}</td><td>{r.date}</td><td>{r.rate}%</td><td>{money(r.base)}</td><td>{money(r.vat)}</td><td>{r.direction==='PURCHASE'?money(r.deductibleVat):'—'}</td></tr>)}
          {!journal.rows.length&&<tr><td colSpan={7}>Nu există alocări calculabile în luna selectată.</td></tr>}
        </tbody></table></div>
        <details><summary>Solduri TVA neexigibilă pe document ({journal.balances.length} poziții)</summary><div className="card-table"><table><thead><tr><th>Sens / document</th><th>Cotă</th><th>Sold inițial RON</th><th>Sold final RON</th></tr></thead><tbody>{journal.balances.map((b,i)=><tr key={i}><td>{b.direction==='SALE'?'Vânzare':'Achiziție'} — {b.reference}</td><td>{b.rate}%</td><td>{money(b.openingVat)}</td><td>{money(b.closingVat)}</td></tr>)}</tbody></table></div></details>
      </>}
    </section>
  </>;
}
