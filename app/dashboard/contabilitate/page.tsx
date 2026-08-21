import { getDashboardStats, listInvoices } from "@/lib/accounting/repo";
import { requireAccountingPage } from "@/lib/accounting/access";
import Link from "next/link";
import { StatusBadge } from "@/components/accounting/StatusBadge";
import { Plus } from "lucide-react";

// This page reads live data straight from Postgres on every request; it must
// never be statically prerendered at build time (which would freeze the
// numbers as of the build, e.g. on Vercel).
export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " RON";
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const recent = (await listInvoices()).slice(0, 7);

  const cards = [
    { label: "Facturi emise", value: stats.totalInvoices.toString(), accent: "var(--cyan)" },
    { label: "Incasat total", value: fmt(stats.totalCollected), accent: "var(--emerald)" },
    { label: "Neincasat", value: fmt(stats.totalOutstanding), warn: stats.totalOutstanding > 0, accent: "var(--amber)" },
    { label: "Facturat luna asta", value: fmt(stats.monthRevenue), accent: "var(--purple)" },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Panou</div>
          <h1 className="page-title">Bine ai venit</h1>
          <p className="page-subtitle">Situatia curenta a facturarii tale.</p>
        </div>
        <Link href="/dashboard/contabilitate/invoices/new" className="btn-primary">
          <Plus size={15} /> Factura noua
        </Link>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card" style={{ "--accent": c.accent } as React.CSSProperties}>
            <div className="stat-label">{c.label}</div>
            <div className={`stat-value ${c.warn ? "warn" : ""}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="section-label">Facturi recente</div>
      <div className="card-table">
        <table>
          <thead>
            <tr>
              <th>Serie/Nr.</th>
              <th>Client</th>
              <th>Data</th>
              <th className="text-right">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  Nu ai emis inca nicio factura.
                </td>
              </tr>
            )}
            {recent.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <Link href={`/dashboard/contabilitate/invoices/${inv.id}`} className="doc-chip">
                    {inv.series} {String(inv.number).padStart(4, "0")}
                  </Link>
                </td>
                <td>{inv.clientName}</td>
                <td className="num">{new Date(inv.issueDate).toLocaleDateString("ro-RO")}</td>
                <td className="text-right num">{fmt(inv.total)}</td>
                <td>
                  <StatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
