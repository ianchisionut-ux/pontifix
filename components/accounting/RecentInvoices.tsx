"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/accounting/StatusBadge";
import { Download, Search } from "lucide-react";

export type RecentInvoice = {
  id: number;
  series: string;
  number: number;
  clientName: string;
  cui: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
  paidAmount: number;
  status: "issued" | "paid" | "partial" | "canceled" | "storno" | "stornoed";
  eFacturaStatus: string | null;
  invoiceType: "STANDARD" | "STORNO";
};

const money = (value: number) => value.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("ro-RO") : "—";

export function RecentInvoices({ invoices }: { invoices: RecentInvoice[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [anaf, setAnaf] = useState("all");
  const [period, setPeriod] = useState("all");
  const [due, setDue] = useState("all");
  const rows = useMemo(() => invoices.filter((invoice) => {
    const query = search.trim().toLocaleLowerCase("ro-RO");
    if (query && !`${invoice.series} ${invoice.number} ${invoice.clientName} ${invoice.cui}`.toLocaleLowerCase("ro-RO").includes(query)) return false;
    if (status !== "all" && invoice.status !== status) return false;
    if (anaf === "pending" && invoice.eFacturaStatus) return false;
    if (anaf === "validated" && invoice.eFacturaStatus !== "VALIDATED") return false;
    if (anaf === "problems" && !["ERROR", "REJECTED"].includes(invoice.eFacturaStatus || "")) return false;
    if (period === "month" && invoice.issueDate.slice(0, 7) !== new Date().toISOString().slice(0, 7)) return false;
    if (due !== "all") {
      const today = new Date().toISOString().slice(0, 10);
      if (due === "today" && invoice.dueDate !== today) return false;
      if (due === "overdue" && (!invoice.dueDate || invoice.dueDate >= today || !["issued", "partial"].includes(invoice.status))) return false;
    }
    return true;
  }), [invoices, search, status, anaf, period, due]);

  return <div className="accounting-invoice-register">
    <div className="accounting-invoice-filters">
      <label className="accounting-filter-search"><Search size={14} aria-hidden="true"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută factură, client sau CUI" aria-label="Caută factură, client sau CUI" /></label>
      <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Perioada"><option value="all">Toate perioadele</option><option value="month">Luna aceasta</option></select>
      <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="all">Toate statusurile</option><option value="issued">Neîncasate</option><option value="partial">Parțiale</option><option value="paid">Achitate</option></select>
      <select value={anaf} onChange={(event) => setAnaf(event.target.value)} aria-label="ANAF"><option value="all">Toate ANAF</option><option value="pending">Netrimise</option><option value="validated">Validate</option><option value="problems">Cu probleme</option></select>
      <select value={due} onChange={(event) => setDue(event.target.value)} aria-label="Scadență"><option value="all">Toate scadențele</option><option value="today">Scadente azi</option><option value="overdue">Restante</option></select>
      <a href="/api/accounting/export/invoices" className="btn-secondary"><Download size={14}/> CSV</a>
    </div>
    <div className="card-table"><table><thead><tr><th>Serie/Nr.</th><th>Data</th><th>Client</th><th>CUI</th><th>Scadență</th><th className="text-right">Total</th><th className="text-right">Achitat</th><th className="text-right">Sold</th><th>Status</th><th>ANAF</th><th>Acțiuni</th></tr></thead><tbody>
      {rows.length === 0 && <tr><td colSpan={11} className="empty-row">Nicio factură pentru filtrele alese.</td></tr>}
      {rows.map((invoice) => <tr key={invoice.id}>
        <td><Link href={`/dashboard/contabilitate/invoices/${invoice.id}`} className="doc-chip">{invoice.series} {String(invoice.number).padStart(4, "0")}</Link></td>
        <td className="num">{date(invoice.issueDate)}</td><td>{invoice.clientName}</td><td>{invoice.cui || "—"}</td><td className="num">{date(invoice.dueDate)}</td>
        <td className="text-right num">{money(invoice.total)}</td><td className="text-right num">{money(invoice.paidAmount)}</td><td className="text-right num">{invoice.invoiceType === "STORNO" || invoice.status === "stornoed" ? "—" : money(Math.max(0, invoice.total - invoice.paidAmount))}</td>
        <td><StatusBadge status={invoice.status}/></td><td><Link href={`/dashboard/contabilitate/invoices/${invoice.id}#e-factura`} className="link-action">{invoice.eFacturaStatus === "VALIDATED" ? "Validată" : ["ERROR", "REJECTED"].includes(invoice.eFacturaStatus || "") ? "Eroare" : invoice.eFacturaStatus ? "În procesare" : "Netrimisă"}</Link></td>
        <td><Link href={`/dashboard/contabilitate/invoices/${invoice.id}`} className="link-action">Deschide</Link></td>
      </tr>)}
    </tbody></table></div>
    <div className="accounting-table-count">{rows.length} din ultimele {invoices.length} facturi · <Link href="/dashboard/contabilitate/invoices">Registrul complet</Link></div>
  </div>;
}
