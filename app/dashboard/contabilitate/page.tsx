import { getDashboardStats, listInvoices } from "@/lib/accounting/repo";
import { getAnafPublicConfig } from "@/lib/accounting/efactura";
import { BillingDashboard, type BillingInvoice } from "@/components/accounting/BillingDashboard";
import { bucharestDate } from "@/lib/accounting/date";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, invoices] = await Promise.all([getDashboardStats(), listInvoices()]);
  const rows: BillingInvoice[] = invoices.map(invoice => {
    const snapshot = invoice.clientSnapshot as { cif?: string } | null;
    return {
      id: invoice.id,
      series: invoice.series,
      number: invoice.number,
      clientName: invoice.clientName,
      clientCif: snapshot?.cif || "",
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      total: Number(invoice.total),
      paidAmount: Number(invoice.paidAmount),
      vatTotal: Number(invoice.vatTotal),
      status: invoice.status,
      invoiceType: invoice.invoiceType,
      eFacturaStatus: invoice.eFacturaStatus,
    };
  });
  return <BillingDashboard invoices={rows} stats={stats} anafEnvironment={getAnafPublicConfig().environment} today={bucharestDate()} />;
}
