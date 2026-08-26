import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getRefReport } from "@/lib/accounting/ref";
async function GETHandler(req: NextRequest) { const year = Number(req.nextUrl.searchParams.get("year") || new Date().getFullYear()); return NextResponse.json(await getRefReport(year)); }
export const GET = accountingApi(GETHandler);