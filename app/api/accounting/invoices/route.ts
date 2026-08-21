import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { listInvoices, createInvoice } from "@/lib/accounting/repo";

async function GETHandler() {
  return NextResponse.json(await listInvoices());
}

async function POSTHandler(req: NextRequest) {
  const data = await req.json();
  const id = await createInvoice(data);
  return NextResponse.json({ id });
}

export const GET = accountingApi(GETHandler)
export const POST = accountingApi(POSTHandler)
