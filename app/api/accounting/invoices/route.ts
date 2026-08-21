import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { listInvoices, createInvoice } from "@/lib/accounting/repo";

async function GETHandler() {
  return NextResponse.json(await listInvoices());
}

async function POSTHandler(req: NextRequest) {
  try {
    const data = await req.json();
    const id = await createInvoice(data);
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Factura nu a putut fi emisă." }, { status: 400 });
  }
}

export const GET = accountingApi(GETHandler)
export const POST = accountingApi(POSTHandler)
