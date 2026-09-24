import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { createPurchase, listPurchases } from "@/lib/accounting/purchases";

async function GETHandler(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return NextResponse.json(await listPurchases(p.get("from") || "", p.get("to") || "", Number(p.get("supplierId") || 0)));
}
async function POSTHandler(req: NextRequest) {
  try { return NextResponse.json({ id: await createPurchase(await req.json()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Factura de intrare nu a putut fi salvată." }, { status: 400 }); }
}
export const GET = accountingApi(GETHandler);
export const POST = accountingApi(POSTHandler);
