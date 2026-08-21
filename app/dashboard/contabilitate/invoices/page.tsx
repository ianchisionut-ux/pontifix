"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/accounting/StatusBadge";
import { Plus, Download, RotateCcw, Trash2 } from "lucide-react";

type InvoiceRow = {
  id: number;
  series: string;
  number: number;
  clientName: string;
  userName: string | null;
  issueDate: string;
  total: number;
  paidAmount: number;
  status: string;
  invoiceType: "STANDARD" | "STORNO";
  originalInvoiceId: number | null;
};

function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/accounting/invoices")
      .then((r) => r.json())
      .then(setInvoices);
  }, []);

  async function removeInvoice(invoice: InvoiceRow) {
    const relationWarning = invoice.invoiceType === "STORNO"
      ? " Factura inițială va redeveni activă."
      : invoice.status === "stornoed" ? " Se va șterge și factura storno legată." : "";
    if (!confirm(`Ștergi definitiv factura ${invoice.series} ${String(invoice.number).padStart(4, "0")}?${relationWarning}`)) return;
    const response = await fetch(`/api/accounting/invoices/${invoice.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) return alert(result.error || "Factura nu a putut fi ștearsă.");
    const updated = await fetch("/api/accounting/invoices").then((result) => result.json()) as InvoiceRow[];
    setInvoices(updated);
  }

  const filtered = invoices.filter((i) => filter === "all" || i.status === filter);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Registru</div>
          <h1 className="page-title">Facturi</h1>
          <p className="page-subtitle">{invoices.length} facturi emise in total.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/contabilitate/invoices/storno" className="btn-secondary">
            <RotateCcw size={15} /> Factură storno
          </Link>
          <Link href="/dashboard/contabilitate/invoices/new" className="btn-primary">
            <Plus size={15} /> Factura noua
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-4" style={{ justifyContent: "space-between" }}>
        <div className="flex gap-2">
          {[
            { k: "all", label: "Toate" },
            { k: "issued", label: "Neincasate" },
            { k: "partial", label: "Partial" },
            { k: "paid", label: "Achitate" },
            { k: "stornoed", label: "Stornate" },
            { k: "storno", label: "Storno" },
          ].map((f) => (
            <button key={f.k} onClick={() => setFilter(f.k)} className={`pill ${filter === f.k ? "active" : ""}`}>
              {f.label}
            </button>
          ))}
        </div>
        <a href="/api/accounting/export/invoices" className="btn-secondary">
          <Download size={14} /> Export CSV
        </a>
      </div>

      <div className="card-table">
        <table>
          <thead>
            <tr>
              <th>Serie/Nr.</th>
              <th>Client</th>
              <th>Intocmit de</th>
              <th>Data</th>
              <th className="text-right">Total</th>
              <th className="text-right">Rest de plata</th>
              <th>Status</th>
              <th className="text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  Nicio factura in aceasta categorie.
                </td>
              </tr>
            )}
            {filtered.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <Link href={`/dashboard/contabilitate/invoices/${inv.id}`} className="doc-chip">
                    {inv.series} {String(inv.number).padStart(4, "0")}
                  </Link>
                </td>
                <td>{inv.clientName}</td>
                <td className="text-neutral-400">{inv.userName ?? "—"}</td>
                <td className="num">{new Date(inv.issueDate).toLocaleDateString("ro-RO")}</td>
                <td className="text-right num">{fmt(inv.total)} RON</td>
                <td className="text-right num">{inv.invoiceType === "STORNO" || inv.status === "stornoed" ? "—" : `${fmt(Math.max(0, inv.total - inv.paidAmount))} RON`}</td>
                <td>
                  <StatusBadge status={inv.status} />
                </td>
                <td className="text-right">
                  <button type="button" onClick={() => removeInvoice(inv)} className="link-danger" title="Șterge factura">
                    <Trash2 size={15}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
