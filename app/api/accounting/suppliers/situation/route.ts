import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { supplierSituation } from "@/lib/accounting/purchases";

async function GETHandler(req: NextRequest) {
  try { return NextResponse.json(await supplierSituation(req.nextUrl.searchParams.get("asOf") || "")); }
  catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Situația furnizorilor nu a putut fi calculată."},{status:400}); }
}
export const GET = accountingApi(GETHandler);
