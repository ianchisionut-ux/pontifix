"use client";
export function AccountHints({suggestions,value,onChoose}:{suggestions:{code:string;name:string}[];value:string;onChoose:(code:string)=>void}) {
  if (!suggestions.length) return null;
  const selected=suggestions.find(account=>account.code===value);
  const alternatives=suggestions.filter(account=>account.code!==value).slice(0,3);
  return <div className="mt-2 flex flex-col gap-1" aria-label="Conturi sugerate">
    <div role="status" className="text-xs text-slate-600">{selected ? <>✓ Cont ales: <strong>{selected.code}</strong> · {selected.name}</> : <>Cont ales: <strong>{value}</strong></>}</div>
    {alternatives.length>0&&<div className="text-xs text-slate-500">Altă încadrare? Aplică un cont:</div>}
    {alternatives.map(account=><button key={account.code} type="button" onClick={()=>onChoose(account.code)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-xs text-[#1c5f92] hover:border-[#1c5f92] hover:bg-slate-100"><span className="font-semibold">Schimbă în {account.code}</span> · {account.name}</button>)}
  </div>;
}
