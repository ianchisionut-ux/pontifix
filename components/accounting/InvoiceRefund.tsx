"use client";
import { useState } from "react";
import { bucharestDate } from "@/lib/accounting/date";

export function InvoiceRefund({ invoiceId, remaining, onSaved }: { invoiceId: number; remaining: number; onSaved: () => void }) {
  const [amount, setAmount] = useState(remaining);
  const [date, setDate] = useState(bucharestDate());
  const [method, setMethod] = useState("bank");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/accounting/invoices/${invoiceId}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, date, method, refund: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Restituirea nu a putut fi înregistrată.");
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Eroare de conexiune."); }
    finally { setBusy(false); }
  }
  return <form className="card mb-6 p-4 space-y-3" onSubmit={save}>
    <h3 className="font-bold">Restituire către client</h3>
    <p>Sold de restituit: {remaining.toFixed(2)} în moneda facturii. Înregistrează aici transferul sau plata deja efectuată.</p>
    <label className="field-label">Sumă<input className="input" type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={e => setAmount(Number(e.target.value))} required /></label>
    <label className="field-label">Data<input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required /></label>
    <label className="field-label">Metodă<select className="input" value={method} onChange={e => setMethod(e.target.value)}><option value="bank">Bancă</option><option value="numerar">Numerar</option></select></label>
    {error && <p role="alert">{error}</p>}
    <button className="btn-primary" disabled={busy || remaining <= 0}>{busy ? "Se salvează…" : "Înregistrează restituirea"}</button>
  </form>;
}
