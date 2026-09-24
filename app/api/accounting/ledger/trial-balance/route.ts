import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getTrialBalance } from "@/lib/accounting/ledger";

async function GETHandler(req: NextRequest) {
  const today = new Date().toISOString().slice(0, 10);
  const from = req.nextUrl.searchParams.get("from") || `${today.slice(0, 4)}-01-01`;
  const to = req.nextUrl.searchParams.get("to") || today;
  return NextResponse.json(await getTrialBalance({ from, to }));
}

export const GET = accountingApi(GETHandler);
