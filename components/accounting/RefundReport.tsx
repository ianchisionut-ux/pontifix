"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function RefundReport() {
  const [rows,setRows] = useState<Array<{id:number;series:string;number:number;clientName:string;currency:string;remaining:number}>>([]);
  const [error,setError] = useState("");
  useEffect(() => { let active = true; fetch('/api/accounting/reports/refunds').then(async response => {
    if (!response.ok) throw new Error('Raportul restituirilor nu a putut fi încărcat.'); return response.json();
  }).then(data => { if(active)setRows(data); }).catch(e => { if(active)setError(e.message); }); return () => { active=false; }; }, []);
  return <section className="card p-4 mb-5"><h2 className="font-bold">Sume de restituit clienților după storno</h2>{error && <p role="alert">{error}</p>}
    {!rows.length && !error && <p>Nu există solduri de restituit în raportul încărcat.</p>}
    {rows.map(row => <p key={row.id}><Link href={`/dashboard/contabilitate/invoices/${row.id}`}>{row.series} {row.number} — {row.clientName}</Link>: {row.remaining.toFixed(2)} {row.currency}</p>)}
  </section>;
}
