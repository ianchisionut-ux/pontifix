import { accountingApi } from '@/lib/accounting/access'
import { listInvoices } from "@/lib/accounting/repo";
import { toCsv, csvResponse } from "@/lib/accounting/csv";

async function GETHandler() {
  const invoices = await listInvoices();
  const csv = toCsv(
    [
      "Serie",
      "Numar",
      "Data emiterii",
      "Client",
      "Intocmit de",
      "Subtotal",
      "TVA",
      "Total",
      "Moneda",
      "Incasat",
      "Rest de plata",
      "Status",
    ],
    invoices.map((i) => ({
      Serie: i.series,
      Numar: String(i.number).padStart(4, "0"),
      "Data emiterii": i.issueDate,
      Client: i.clientName,
      "Intocmit de": i.userName ?? "",
      Subtotal: i.subtotal.toFixed(2),
      TVA: i.vatTotal.toFixed(2),
      Total: i.total.toFixed(2),
      Moneda: i.currency,
      Incasat: i.paidAmount.toFixed(2),
      "Rest de plata": (i.total - i.paidAmount).toFixed(2),
      Status: i.status,
    }))
  );
  return csvResponse("facturi.csv", csv);
}

export const GET = accountingApi(GETHandler)
