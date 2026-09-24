import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { supplierSituation } from "@/lib/accounting/purchases";

async function GETHandler(req: NextRequest) { return NextResponse.json(await supplierSituation(req.nextUrl.searchParams.get("asOf") || "")); }
export const GET = accountingApi(GETHandler);
