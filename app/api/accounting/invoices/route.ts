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
    const id = await createInvoice(data);
    after(async () => {
      try {
        const connection = await getAnafConnectionStatus();
        if (connection.configured && connection.connected) await sendInvoiceToAnaf(id);
      } catch (error) {
        console.error(`Trimiterea automată e-Factura pentru factura ${id} a eșuat:`, error);
      }
    });
    return NextResponse.json({ id, eFactura: { status: "PENDING" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Factura nu a putut fi emisă." }, { status: 400 });
  }
}

export const GET = accountingApi(GETHandler)
export const POST = accountingApi(POSTHandler)