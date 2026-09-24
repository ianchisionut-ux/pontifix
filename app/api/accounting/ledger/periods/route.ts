import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { listPeriods, setPeriodStatus } from "@/lib/accounting/ledger";

async function GETHandler(req: NextRequest) {
  const year = Number(req.nextUrl.searchParams.get("year") || new Date().getFullYear());
  return NextResponse.json(await listPeriods(year));
}

async function PATCHHandler(req: NextRequest) {
  try {
    const data = await req.json();
    await setPeriodStatus(Number(data.year), Number(data.month), data.status, String(data.closedBy || ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Perioada nu a putut fi actualizată." }, { status: 400 });
  }
}

export const GET = accountingApi(GETHandler);
export const PATCH = accountingApi(PATCHHandler);
