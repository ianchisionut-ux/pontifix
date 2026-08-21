"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { StatusBadge } from "@/components/accounting/StatusBadge";

type InvoiceRow = {
  id: number; series: string; number: number; clientName: string; issueDate: string;
  total: number; paidAmount: number; status: string; invoiceType: "STANDARD" | "STORNO";
};

function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StornoInvoicePage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [series, setSeries] = useState("STO");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/accounting/invoices").then((r) => r.json()).then((rows: InvoiceRow[]) => {
      const eligible = rows.filter((invoice) => invoice.invoiceType !== "STORNO" && !["storno", "stornoed", "canceled"].includes(invoice.status));
      setInvoices(eligible);
      const queryId = new URLSearchParams(window.location.search).get("invoice");
      if (queryId && eligible.some((invoice) => String(invoice.id) === queryId)) setInvoiceId(queryId);
    });
  }, []);

  const selected = useMemo(() => invoices.find((invoice) => String(invoice.id) === invoiceId), [invoices, invoiceId]);

  async function submit() {
    if (!invoiceId) return alert("Selectează factura care trebuie stornată.");
    if (!reason.trim()) return alert("Completează motivul stornării.");
    if (!confirm(`Creezi factura storno pentru ${selected?.series} ${String(selected?.number || 0).padStart(4, "0")}?`)) return;
    setSaving(true);
    const response = await fetch(`/api/accounting/invoices/${invoiceId}/storno`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series, issueDate, reason }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return alert(data.error || "Factura nu a putut fi stornată.");
    router.push(`/dashboard/contabilitate/invoices/${data.id}`);
  }

  return <div>
    <div className="page-head">
      <div><div className="eyebrow">Corecție fiscală</div><h1 className="page-title">Factură storno</h1><p className="page-subtitle">Selectează factura greșită; sistemul generează automat aceleași poziții cu valori negative.</p></div>
    </div>

    <div className="card mb-4" style={{ maxWidth: 860 }}>
      <div className="grid grid-cols-3 gap-4">
        <div style={{ gridColumn: "span 3" }}>
          <label className="field-label">Factura de stornat</label>
          <select className="input" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">— selectează factura —</option>
            {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.series} {String(invoice.number).padStart(4, "0")} · {invoice.clientName} · {fmt(invoice.total)} RON</option>)}
          </select>
        </div>
        <div><label className="field-label">Serie storno</label><input className="input" value={series} onChange={(e) => setSeries(e.target.value.toUpperCase())}/></div>
        <div><label className="field-label">Data emiterii</label><input type="date" className="input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}/></div>
        <div><label className="field-label">Tip document</label><div className="input flex items-center"><RotateCcw size={15} className="mr-2"/> Factură storno integrală</div></div>
        <div style={{ gridColumn: "span 3" }}><label className="field-label">Motivul stornării</label><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: date beneficiar greșite / valoare facturată eronat"/></div>
      </div>
    </div>

    {selected && <div className="card mb-5" style={{ maxWidth: 860, background: "#fff7f7" }}>
      <div className="flex items-center justify-between"><div><div className="font-bold">{selected.series} {String(selected.number).padStart(4, "0")} · {selected.clientName}</div><div className="text-sm text-slate-500 mt-1">Emisă la {new Date(selected.issueDate).toLocaleDateString("ro-RO")} · total {fmt(selected.total)} RON</div></div><StatusBadge status={selected.status}/></div>
      <p className="text-xs text-slate-500 mt-3">Noua factură va avea totalul de -{fmt(Math.abs(selected.total))} RON și va fi legată de documentul inițial.</p>
    </div>}

    <button type="button" className="btn-danger" onClick={submit} disabled={saving || !selected} style={{ padding: "11px 22px" }}><RotateCcw size={15}/>{saving ? "Se stornează..." : "Emite factura storno"}</button>
  </div>;
}
