import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { createSupplier, listSuppliers } from "@/lib/accounting/purchases";

async function GETHandler(req: NextRequest) {
  return NextResponse.json(await listSuppliers(req.nextUrl.searchParams.get("q") || ""));
}
async function POSTHandler(req: NextRequest) {
  try { return NextResponse.json({ id: await createSupplier(await req.json()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Furnizorul nu a putut fi salvat." }, { status: 400 }); }
}
export const GET = accountingApi(GETHandler);
export const POST = accountingApi(POSTHandler);
