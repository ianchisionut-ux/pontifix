"use client";
import { useEffect,useState } from 'react';
import { AccountPicker } from './AccountPicker';
import type { PurchaseInput } from '@/lib/accounting/purchases';
export function ReceivedInvoiceReview({messageId,payload,issues,onSaved,onClose}:{messageId:string;payload:PurchaseInput;issues:string[];onSaved:()=>void;onClose:()=>void}) {
 const [form,setForm]=useState(payload),[accounts,setAccounts]=useState<{code:string;name:string}[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/accounting/ledger/accounts').then(r=>r.json()).then(rows=>setAccounts(rows.filter((row:{active:number;allowPosting:number})=>row.active&&row.allowPosting))).catch(()=>setError('Conturile nu au putut fi încărcate.'))},[]);
 async function save(){setBusy(true);setError('');try{const response=await fetch(`/api/accounting/efactura/messages/${encodeURIComponent(messageId)}/import`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewed:form})}),result=await response.json();if(!response.ok||!result.purchaseId)throw new Error(result.error||result.issues?.join(' ')||'Verifică factura.');onSaved()}catch(reason){setError((reason as Error).message)}finally{setBusy(false)}}
 return <div className="card my-5"><h2 className="text-lg font-bold">Verifică factura primită {payload.documentNumber}</h2><p className="mt-2 text-sm">{issues.join(' ')}</p>
 {error&&<p role="alert" className="ref-error">{error}</p>}
 <label className="field-label mt-3">Curs valutar ({form.currency})<input className="input" type="number" step="0.000001" min="0.000001" disabled={form.currency==='RON'} value={form.exchangeRate||''} onChange={event=>setForm({...form,exchangeRate:Number(event.target.value)})}/></label>
 <div className="mt-3 space-y-3">{form.items?.map((line,index)=><div key={index} className="rounded border border-slate-300 p-3"><p className="mb-2 text-sm font-semibold">{line.description} · {line.quantity} × {Number(line.unitPrice).toFixed(2)} · TVA {line.vatRate}%</p>
 <div className="grid gap-3 md:grid-cols-2"><AccountPicker label={`Cont poziție import ${index+1}`} accounts={accounts} value={line.expenseAccount||''} onChange={code=>setForm({...form,items:form.items?.map((item,i)=>i===index?{...item,expenseAccount:code}:item)})}/>
 <label className="field-label">TVA deductibilă (%)<input className="input" type="number" min="0" max="100" value={line.deductibilityPercent??100} onChange={event=>setForm({...form,items:form.items?.map((item,i)=>i===index?{...item,deductibilityPercent:Number(event.target.value)}:item)})}/></label></div></div>)}</div>
 <div className="mt-4 flex gap-3"><button className="btn-primary" disabled={busy} onClick={save}>{busy?'Se înregistrează…':'Înregistrează și contează'}</button><button className="btn-secondary" disabled={busy} onClick={onClose}>Închide</button></div>
 </div>;
}
