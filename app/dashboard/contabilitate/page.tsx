import { getDashboardStats, listInvoices } from "@/lib/accounting/repo";
import { requireAccountingPage } from "@/lib/accounting/access";
import Link from "next/link";
import { RecentInvoices } from "@/components/accounting/RecentInvoices";
import { getAnafPublicConfig } from "@/lib/accounting/efactura";
import { Plus, TriangleAlert } from "lucide-react";

// This page reads live data straight from Postgres on every request; it must
// never be statically prerendered at build time (which would freeze the
// numbers as of the build, e.g. on Vercel).
export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " RON";
}

export default async function DashboardPage() {
  const [stats, recent] = await Promise.all([
    getDashboardStats(),
    listInvoices(12),
  ]);
  const anaf = getAnafPublicConfig();
  const anafProblems = stats.anafProblems;

  const cards = [
    { label: "Facturi emise", value: stats.totalInvoices.toString(), accent: "var(--cyan)" },
    { label: "Facturat luna asta", value: fmt(stats.monthRevenue), accent: "var(--purple)" },
    { label: "Încasat total", value: fmt(stats.totalCollected), accent: "var(--emerald)" },
    { label: "Sold neîncasat", value: fmt(stats.totalOutstanding), warn: stats.totalOutstanding > 0, accent: "var(--amber)" },
    { label: "Restante", value: stats.overdueInvoices.toString(), warn: stats.overdueInvoices > 0, accent: "var(--amber)" },
    { label: "Scadente azi", value: stats.dueToday.toString(), accent: "var(--purple)" },
    { label: "TVA luna asta", value: fmt(stats.monthVat), accent: "var(--cyan)" },
    { label: "Erori ANAF", value: stats.anafProblems.toString(), warn: stats.anafProblems > 0, accent: "var(--red)" },
  ];

  return (
    <div className="accounting-overview">
      <div className="page-head">
        <div>
          <h2 className="page-title">Panou facturare</h2>
        </div>
        <Link href="/dashboard/contabilitate/invoices/new" className="btn-primary">
          <Plus size={15} /> Factura noua
        </Link>
      </div>

      {anaf.environment === "test" && <div className="ef-safety-warning mb-4"><TriangleAlert size={17}/><span><strong>ANAF Test este activ.</strong> Trimiterile nu au efect fiscal real. Activează Producție înainte de folosirea operațională.</span></div>}
      {anafProblems > 0 && <Link href="/dashboard/contabilitate/invoices" className="ref-error ef-dashboard-alert"><TriangleAlert size={17}/><span><strong>{anafProblems} {anafProblems === 1 ? "factură necesită" : "facturi necesită"} atenție la e-Factura.</strong> Deschide registrul pentru detalii și retransmitere.</span></Link>}

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card" style={{ "--accent": c.accent } as React.CSSProperties}>
            <div className="stat-label">{c.label}</div>
            <div className={`stat-value ${c.warn ? "warn" : ""}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <RecentInvoices invoices={recent.map((inv) => ({
        id: inv.id, series: inv.series, number: inv.number, clientName: inv.clientName,
        cui: "cif" in inv.clientSnapshot ? String(inv.clientSnapshot.cif || "") : "",
        issueDate: inv.issueDate, dueDate: inv.dueDate, total: inv.total,
        paidAmount: inv.paidAmount, status: inv.status, eFacturaStatus: inv.eFacturaStatus,
        invoiceType: inv.invoiceType,
      }))} />
    </div>
  );
}
