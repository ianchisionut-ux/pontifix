import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getDeclarationPeriod, updateDeclarationPeriod } from "@/lib/accounting/declarations";

function period(req: NextRequest) {
  return { year: Number(req.nextUrl.searchParams.get("year")), month: Number(req.nextUrl.searchParams.get("month")) };
}

async function GETHandler(req: NextRequest) {
  try { const { year, month } = period(req); return NextResponse.json(await getDeclarationPeriod(year, month)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Perioada nu a putut fi calculată." }, { status: 400 }); }
}

async function PUTHandler(req: NextRequest) {
  try { const { year, month } = period(req); return NextResponse.json(await updateDeclarationPeriod(year, month, await req.json())); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Perioada nu a putut fi actualizată." }, { status: 400 }); }
}

export const GET = accountingApi(GETHandler);
export const PUT = accountingApi(PUTHandler);
