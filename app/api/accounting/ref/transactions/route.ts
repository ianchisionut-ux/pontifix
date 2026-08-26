import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { createRefTransaction, getRefReport } from "@/lib/accounting/ref";

async function GETHandler(req: NextRequest) {
  const year = Number(req.nextUrl.searchParams.get("year") || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return NextResponse.json({ error: "An fiscal invalid." }, { status: 400 });
  return NextResponse.json(await getRefReport(year));
}

async function POSTHandler(req: NextRequest) {
  try {
    const data = await req.json();
    const id = await createRefTransaction({ ...data, grossAmount: Number(data.grossAmount), vatAmount: Number(data.vatAmount || 0), deductibilityPercent: Number(data.deductibilityPercent ?? 100) });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Înregistrarea REF nu a putut fi salvată." }, { status: 400 });
  }
}
export const GET = accountingApi(GETHandler);
export const POST = accountingApi(POSTHandler);