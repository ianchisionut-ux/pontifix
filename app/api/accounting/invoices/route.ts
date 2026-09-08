import { accountingApi } from '@/lib/accounting/access'
import { after, type NextRequest, NextResponse } from "next/server";
import { listInvoices, createInvoice } from "@/lib/accounting/repo";
import { getAnafConnectionStatus, sendInvoiceToAnaf } from "@/lib/accounting/efactura";

async function GETHandler() {
  return NextResponse.json(await listInvoices());
}

async function POSTHandler(req: NextRequest) {
  try {
    const data = await req.json();
    if (data.anafEnvironment !== (process.env.ANAF_ENVIRONMENT === 'production' ? 'production' : 'test')) return NextResponse.json({ error: 'Mediul ANAF s-a schimbat. Reîncarcă pagina și confirmă din nou.' }, { status: 409 });
    if (typeof data.sendToAnafNow !== "boolean") return NextResponse.json({ error: "Alege trimiterea la ANAF acum sau în ziua următoare." }, { status: 400 });
    const id = await createInvoice(data);
    if (data.sendToAnafNow) after(async () => {
      try {
        const connection = await getAnafConnectionStatus();
        if (connection.configured && connection.connected) await sendInvoiceToAnaf(id);
      } catch (error) {
        console.error(`Trimiterea automată e-Factura pentru factura ${id} a eșuat:`, error);
      }
    });
    return NextResponse.json({ id, eFactura: { status: data.sendToAnafNow ? "PENDING" : "DEFERRED" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Factura nu a putut fi emisă." }, { status: 400 });
  }
}

export const GET = accountingApi(GETHandler)
export const POST = accountingApi(POSTHandler)
