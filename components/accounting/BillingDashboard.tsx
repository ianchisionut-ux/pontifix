"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, FileDown, MoreHorizontal, Plus, RefreshCw, X } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { bucharestDate } from "@/lib/accounting/date";

export type BillingInvoice = {
  id: number;
  series: string;
  number: number;
  clientName: string;
  clientCif: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
  paidAmount: number;
  vatTotal: number;
  status: string;
  invoiceType: string;
  eFacturaStatus: string | null;
};

type Stats = { totalInvoices: number; totalOutstanding: number; totalCollected: number; monthRevenue: number; anafProblems: number };
const base = "/dashboard/contabilitate/invoices";
const money = (value: number) => Number(value).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("ro-RO") : "—";
const day = (value: string | null) => value?.slice(0, 10) || "";
const balance = (invoice: BillingInvoice) => ["STORNO"].includes(invoice.invoiceType) || ["stornoed", "canceled"].includes(invoice.status) ? 0 : Math.max(0, Number(invoice.total) - Number(invoice.paidAmount));
const anafGroup = (status: string | null) => !status ? "pending" : status === "VALIDATED" ? "validated" : ["ERROR", "REJECTED"].includes(status) ? "problem" : "processing";
const anafLabel = (status: string | null) => ({ pending: "Netrimisă", validated: "Validată", problem: "Problemă", processing: "În procesare" })[anafGroup(status)];

export function BillingDashboard({ invoices, stats, anafEnvironment, today }: { invoices: BillingInvoice[]; stats: Stats; anafEnvironment: "test" | "production"; today: string }) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const [status, setStatus] = useState("all");
  const [anaf, setAnaf] = useState("all");
  const [due, setDue] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const month = today.slice(0, 7);
  const overdue = invoices.filter(inv => balance(inv) > 0 && day(inv.dueDate) && day(inv.dueDate) < today).length;
  const dueToday = invoices.filter(inv => balance(inv) > 0 && day(inv.dueDate) === today).length;
  const monthVat = invoices.filter(inv => day(inv.issueDate).startsWith(month) && !["canceled", "stornoed"].includes(inv.status)).reduce((sum, inv) => sum + Number(inv.vatTotal), 0);
  const pendingAnaf = invoices.filter(inv => anafGroup(inv.eFacturaStatus) === "pending" && inv.invoiceType !== "STORNO").length;
  const kpis = [
    ["Facturi", String(stats.totalInvoices)], ["Facturat luna aceasta", money(stats.monthRevenue)],
    ["Încasat", money(stats.totalCollected)], ["Sold clienți", money(stats.totalOutstanding)],
    ["Restante", String(overdue)], ["Scadente azi", String(dueToday)],
    ["TVA luna aceasta", money(monthVat)], ["ANAF netrimise / erori", `${pendingAnaf} / ${stats.anafProblems}`],
  ];
  const filtered = useMemo(() => invoices.filter(inv => {
    const q = query.trim().toLocaleLowerCase("ro-RO");
    const matchesQuery = !q || `${inv.series} ${inv.number} ${inv.clientName} ${inv.clientCif}`.toLocaleLowerCase("ro-RO").includes(q);
    const issued = day(inv.issueDate);
    const matchesPeriod = period === "all" || period === "month" && issued.startsWith(month) || period === "30" && issued >= bucharestDate(new Date(Date.now() - 30 * 86400000));
    const matchesDue = due === "all" || due === "overdue" && balance(inv) > 0 && !!day(inv.dueDate) && day(inv.dueDate) < today || due === "today" && balance(inv) > 0 && day(inv.dueDate) === today;
    return matchesQuery && matchesPeriod && matchesDue && (status === "all" || inv.status === status) && (anaf === "all" || anafGroup(inv.eFacturaStatus) === anaf);
  }), [invoices, query, period, status, anaf, due, month, today]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  const visible = filtered.slice((page - 1) * 50, page * 50);
  const selected = invoices.find(inv => inv.id === selectedId);
  useEffect(() => setPage(1), [query, period, status, anaf, due]);
  useEffect(() => {
    if (selectedId === null) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedId(null); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, [selectedId]);

  return <div className="billing-dashboard">
    <header className="billing-page-head">
      <h1>Panou facturare</h1>
      <div className="billing-page-actions"><span className={`billing-environment ${anafEnvironment}`}>ANAF ● {anafEnvironment === "test" ? "TEST" : "PRODUCȚIE"}</span><Link href={`${base}/new`} className="btn-primary"><Plus size={15}/> Factură nouă</Link></div>
    </header>
    {anafEnvironment === "test" && <p className="billing-test-note">Trimiterile ANAF din mediul TEST nu au efect fiscal.</p>}
    <div className="billing-kpis">{kpis.map(([label, value]) => <div className="billing-kpi" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <section className="billing-register" aria-label="Registru facturi">
      <div className="billing-filters">
        <input aria-label="Caută factură sau client" placeholder="Caută factură sau client…" value={query} onChange={e => setQuery(e.target.value)}/>
        <select aria-label="Perioadă" value={period} onChange={e => setPeriod(e.target.value)}><option value="all">Toate perioadele</option><option value="month">Luna curentă</option><option value="30">Ultimele 30 zile</option></select>
        <select aria-label="Status factură" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Toate statusurile</option><option value="issued">Neîncasate</option><option value="partial">Parțial</option><option value="paid">Achitate</option><option value="stornoed">Stornate</option><option value="storno">Storno</option></select>
        <select aria-label="Status ANAF" value={anaf} onChange={e => setAnaf(e.target.value)}><option value="all">Toate ANAF</option><option value="pending">Netrimise</option><option value="processing">În procesare</option><option value="validated">Validate</option><option value="problem">Cu probleme</option></select>
        <select aria-label="Scadență" value={due} onChange={e => setDue(e.target.value)}><option value="all">Toate scadențele</option><option value="overdue">Restante</option><option value="today">Scadente azi</option></select>
        <div className="billing-filter-actions"><a href="/api/accounting/export/invoices" className="btn-secondary"><Download size={14}/> CSV</a><button type="button" className="btn-secondary" onClick={() => window.location.reload()} aria-label="Actualizează datele"><RefreshCw size={14}/></button></div>
      </div>
      <div className="billing-table-scroll"><table className="billing-table"><thead><tr><th>Serie/Nr.</th><th>Data</th><th>Client</th><th>CUI</th><th>Scadență</th><th>Total</th><th>Achitat</th><th>Sold</th><th>Status</th><th>ANAF</th><th>Acțiuni</th></tr></thead><tbody>
        {visible.length === 0 && <tr><td colSpan={11} className="billing-empty">Nu există facturi pentru filtrele selectate.</td></tr>}
        {visible.map(inv => <tr key={inv.id} onClick={() => setSelectedId(inv.id)}>
          <td><button type="button" className="billing-invoice-link" onClick={() => setSelectedId(inv.id)}>{inv.series} {String(inv.number).padStart(4, "0")}</button></td>
          <td>{date(inv.issueDate)}</td><td title={inv.clientName}>{inv.clientName}</td><td>{inv.clientCif || "—"}</td><td>{date(inv.dueDate)}</td>
          <td>{money(inv.total)}</td><td>{money(inv.paidAmount)}</td><td>{money(balance(inv))}</td><td><StatusBadge status={inv.status}/></td><td>{anafLabel(inv.eFacturaStatus)}</td>
          <td><button type="button" className="billing-more" onClick={event => { event.stopPropagation(); setSelectedId(inv.id); }} aria-label={`Detalii factura ${inv.series} ${inv.number}`}><MoreHorizontal size={18}/></button></td>
        </tr>)}
      </tbody></table></div>
      <div className="billing-pagination"><span>{filtered.length ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, filtered.length)} din {filtered.length}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button><span>{page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>›</button></div></div>
    </section>
    {selected && <div className="billing-drawer-backdrop" onClick={() => setSelectedId(null)}><aside className="billing-drawer" role="dialog" aria-modal="true" aria-label={`Factura ${selected.series} ${selected.number}`} onClick={event => event.stopPropagation()}>
      <div className="billing-drawer-head"><div><small>FACTURĂ</small><h2>{selected.series} {String(selected.number).padStart(4, "0")}</h2></div><button ref={closeButton} type="button" onClick={() => setSelectedId(null)} aria-label="Închide"><X size={20}/></button></div>
      <h3>{selected.clientName}</h3><p>{selected.clientCif || "CUI necompletat"}</p>
      <dl><div><dt>Total</dt><dd>{money(selected.total)} RON</dd></div><div><dt>Achitat</dt><dd>{money(selected.paidAmount)} RON</dd></div><div><dt>Sold</dt><dd>{money(balance(selected))} RON</dd></div><div><dt>Scadență</dt><dd>{date(selected.dueDate)}</dd></div><div><dt>ANAF</dt><dd>{anafLabel(selected.eFacturaStatus)}</dd></div></dl>
      <div className="billing-drawer-actions">
        <Link href={`${base}/${selected.id}`} className="btn-primary">Deschide / Încasează</Link>
        <a href={`/api/accounting/invoices/${selected.id}/pdf`} className="btn-secondary" download><FileDown size={15}/> PDF</a>
        <a href={`/api/accounting/efactura/invoices/${selected.id}/xml`} className="btn-secondary" download>XML</a>
        {selected.invoiceType !== "STORNO" && !["stornoed", "canceled"].includes(selected.status) && <Link href={`${base}/storno?invoice=${selected.id}`} className="btn-secondary">Stornează</Link>}
      </div>
    </aside></div>}
  </div>;
}
