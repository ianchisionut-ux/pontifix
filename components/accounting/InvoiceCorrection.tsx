"use client";
import { useState } from "react";

type Correction = { clientId: number; dueDate: string; paymentTerms: string; notes: string; items: { id: number; description: string; qty: number; unitPrice: number }[] };
export function InvoiceCorrection({ invoiceId }: { invoiceId: number }) {
  const [value, setValue] = useState<Correction | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [clients, setClients] = useState<{id:number;name:string}[]>([]);
  async function open() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/accounting/invoices/${invoiceId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setValue({ clientId: data.invoice.clientId, dueDate: data.invoice.dueDate || "", paymentTerms: data.invoice.paymentTerms || "", notes: data.invoice.notes || "", items: data.items.map((i: Correction['items'][number]) => ({ id: i.id, description: i.description, qty: Number(i.qty), unitPrice: Number(i.unitPrice) })) });
      const clientResponse = await fetch('/api/accounting/clients');
      if (clientResponse.ok) setClients(await clientResponse.json());
    } catch { setMessage("Factura nu a putut fi încărcată."); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/accounting/invoices/${invoiceId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Salvarea a eșuat."); } finally { setBusy(false); }
  }
  return <div className="card mb-4">
    <button className="btn-secondary" disabled={busy} onClick={open}>Corectează detaliile înainte de transmitere</button>
    <p className="text-xs mt-2">Corectezi detaliile, beneficiarul, cantitățile și prețurile înainte de transmitere sau după respingerea exclusiv în Test. După încasare, beneficiarul și valorile sunt protejate. TVA-ul, plățile și chitanțele nu sunt modificate.</p>
    {message && <p role="alert" className="text-red-600 mt-2">{message}</p>}
    {value && <div className="space-y-3 mt-3">
      <label className="block">Beneficiar<select className="input" value={value.clientId} onChange={e => setValue({...value,clientId:Number(e.target.value)})}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {value.items.map(item => <div className="flex gap-3" key={`amount-${item.id}`}><label>Cantitate<input type="number" min="0.001" step="any" className="input" value={item.qty} onChange={e=>setValue({...value,items:value.items.map(i=>i.id===item.id?{...i,qty:Number(e.target.value)}:i)})}/></label><label>Preț unitar<input type="number" min="0" step="any" className="input" value={item.unitPrice} onChange={e=>setValue({...value,items:value.items.map(i=>i.id===item.id?{...i,unitPrice:Number(e.target.value)}:i)})}/></label></div>)}
      <label className="block">Scadență<input className="input" type="date" value={value.dueDate} onChange={e => setValue({ ...value, dueDate: e.target.value })}/></label>
      <label className="block">Termene de plată<input className="input" value={value.paymentTerms} onChange={e => setValue({ ...value, paymentTerms: e.target.value })}/></label>
      <label className="block">Observații<textarea className="input" value={value.notes} onChange={e => setValue({ ...value, notes: e.target.value })}/></label>
      {value.items.map((item, index) => <label className="block" key={item.id}>Descriere poziția {index + 1}<input className="input" value={item.description} onChange={e => setValue({ ...value, items: value.items.map(i => i.id === item.id ? { ...i, description: e.target.value } : i) })}/></label>)}
      <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Se salvează…" : "Salvează corecțiile"}</button>
      <button className="btn-secondary ml-2" disabled={busy} onClick={() => setValue(null)}>Renunță</button>
    </div>}
  </div>;
}
