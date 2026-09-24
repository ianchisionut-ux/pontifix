import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getAccountLedger } from "@/lib/accounting/ledger";

async function GETHandler(req: NextRequest) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const code = req.nextUrl.searchParams.get("code") || "4111";
    const from = req.nextUrl.searchParams.get("from") || `${today.slice(0, 4)}-01-01`;
    const to = req.nextUrl.searchParams.get("to") || today;
    return NextResponse.json(await getAccountLedger(code, { from, to }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Fișa nu a putut fi generată." }, { status: 400 });
  }
}

export const GET = accountingApi(GETHandler);
