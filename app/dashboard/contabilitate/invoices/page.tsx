"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/accounting/StatusBadge";
import { Plus, Download, Eye, RotateCcw, Trash2, TriangleAlert } from "lucide-react";

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
  eFacturaStatus: string | null;
  eFacturaMessage: string | null;
  eFacturaSubmissionId: number | null;
  eFacturaUploadId: string | null;
  eFacturaDownloadId: string | null;
  eFacturaSubmittedAt: string | null;
  eFacturaCheckedAt: string | null;
  eFacturaAttemptNumber: number | null;
  eFacturaRetryable: number | null;
};

function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AnafStatus({ status, message, uploadId }: { status: string | null; message: string | null; uploadId: string | null }) {
  const normalized = status || "PENDING";
  const palette = normalized === "VALIDATED"
    ? { color: "#16a34a", label: "Validată ANAF" }
    : ["REJECTED", "ERROR"].includes(normalized)
      ? { color: "#dc2626", label: normalized === "REJECTED" ? "Respinsă ANAF" : "Eroare trimitere" }
      : { color: "#eab308", label: normalized === "PENDING" ? "Netrimisă încă" : "În procesare ANAF" };
  return (
    <span title={[message, uploadId ? `ID încărcare: ${uploadId}` : ""].filter(Boolean).join("\n") || palette.label} className="inline-flex items-center gap-2 text-xs font-semibold whitespace-nowrap">
      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: palette.color, boxShadow: `0 0 0 3px ${palette.color}22` }} />
      <span>{palette.label}{uploadId && <small className="ef-list-id">ID {uploadId}</small>}</span>
    </span>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [anafFilter, setAnafFilter] = useState<string>("all");
  const [anafEnvironment, setAnafEnvironment] = useState<"test" | "production" | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounting/invoices").then((r) => r.json()),
      fetch("/api/accounting/efactura/status").then((r) => r.json()),
    ]).then(([rows, anaf]) => {
      setInvoices(Array.isArray(rows) ? rows : []);
      setAnafEnvironment(anaf?.environment || null);
    });
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

  const anafGroup = (status: string | null): "pending" | "processing" | "validated" | "problems" => !status ? "pending" : ["UPLOADING", "PROCESSING"].includes(status) ? "processing" : status === "VALIDATED" ? "validated" : "problems";
  const filtered = invoices.filter((i) => (filter === "all" || i.status === filter) && (anafFilter === "all" || anafGroup(i.eFacturaStatus) === anafFilter));
  const anafCounts = invoices.reduce((result, invoice) => {
    result[anafGroup(invoice.eFacturaStatus)] += 1;
    return result;
  }, { pending: 0, processing: 0, validated: 0, problems: 0 });

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

      {anafEnvironment === "test" && <div className="ef-safety-warning mb-4"><TriangleAlert size={17}/><span><strong>ANAF Test este activ.</strong> Statusurile și trimiterile de aici nu au efect fiscal real. Pentru protecția legală trebuie activat mediul Producție.</span></div>}

      <div className="stat-grid">
        {[
          { key: "pending", label: "Netrimise", value: anafCounts.pending, accent: "var(--amber)" },
          { key: "processing", label: "În procesare ANAF", value: anafCounts.processing, accent: "#eab308" },
          { key: "validated", label: "Validate ANAF", value: anafCounts.validated, accent: "var(--emerald)" },
          { key: "problems", label: "Necesită atenție", value: anafCounts.problems, accent: "var(--red)" },
        ].map((item) => <button type="button" key={item.key} className="stat-card ef-stat-button" style={{ "--accent": item.accent } as React.CSSProperties} onClick={() => setAnafFilter(anafFilter === item.key ? "all" : item.key)}>
          <span className="stat-label">{item.label}</span><span className="stat-value">{item.value}</span>
        </button>)}
      </div>

      <div className="flex gap-2 mb-4" style={{ justifyContent: "space-between" }}>
        <div className="flex gap-2 flex-wrap">
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
          <span className="ef-filter-separator" />
          {[
            { k: "all", label: "Toate ANAF" },
            { k: "pending", label: "Netrimise ANAF" },
            { k: "processing", label: "În procesare" },
            { k: "validated", label: "Validate ANAF" },
            { k: "problems", label: "Cu probleme" },
          ].map((f) => (
            <button key={f.k} onClick={() => setAnafFilter(f.k)} className={`pill ${anafFilter === f.k ? "active" : ""}`}>
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
              <th>e-Factura ANAF</th>
              <th className="text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">
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
                <td><Link href={`/dashboard/contabilitate/invoices/${inv.id}#e-factura`}><AnafStatus status={inv.eFacturaStatus} message={inv.eFacturaMessage} uploadId={inv.eFacturaUploadId} /></Link></td>
                <td className="text-right">
                  <span className="ef-row-actions">
                    <Link href={`/dashboard/contabilitate/invoices/${inv.id}#e-factura`} className="link-action" title="Vezi statusul și identificatorii ANAF"><Eye size={15}/></Link>
                    {(!inv.eFacturaStatus || (inv.eFacturaStatus === "ERROR" && !inv.eFacturaUploadId)) && <button type="button" onClick={() => removeInvoice(inv)} className="link-danger" title="Șterge factura"><Trash2 size={15}/></button>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
