import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { getSalesByAgent } from "@/lib/accounting/repo";

async function GETHandler(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") || undefined;
  const to = req.nextUrl.searchParams.get("to") || undefined;
  return NextResponse.json(await getSalesByAgent({ from, to }));
}

export const GET = accountingApi(GETHandler)
