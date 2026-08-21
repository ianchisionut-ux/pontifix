import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { getProfitByProduct } from "@/lib/accounting/repo";

async function GETHandler(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") || undefined;
  const to = req.nextUrl.searchParams.get("to") || undefined;
  return NextResponse.json(await getProfitByProduct({ from, to }));
}

export const GET = accountingApi(GETHandler)
