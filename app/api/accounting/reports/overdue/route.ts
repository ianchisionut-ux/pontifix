import { accountingApi } from '@/lib/accounting/access'
import { NextResponse } from "next/server";
import { getOverdueInvoices } from "@/lib/accounting/repo";

async function GETHandler() {
  return NextResponse.json(await getOverdueInvoices());
}

export const GET = accountingApi(GETHandler)
