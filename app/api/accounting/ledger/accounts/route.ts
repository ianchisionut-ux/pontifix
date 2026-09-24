import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { createAnalyticAccount, listAccounts, setAccountActive } from "@/lib/accounting/ledger";

async function GETHandler(req: NextRequest) {
  return NextResponse.json(await listAccounts(req.nextUrl.searchParams.get("q") || ""));
}

async function POSTHandler(req: NextRequest) {
  try {
    await createAnalyticAccount(await req.json());
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Contul nu a putut fi creat." }, { status: 400 });
  }
}

async function PATCHHandler(req: NextRequest) {
  try {
    const data = await req.json();
    await setAccountActive(String(data.code || ""), Boolean(data.active));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Contul nu a putut fi actualizat." }, { status: 400 });
  }
}

export const GET = accountingApi(GETHandler);
export const POST = accountingApi(POSTHandler);
export const PATCH = accountingApi(PATCHHandler);
