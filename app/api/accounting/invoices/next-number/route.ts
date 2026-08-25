import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { peekNextNumber } from "@/lib/accounting/repo";

async function GETHandler(req: NextRequest) {
  const series = req.nextUrl.searchParams.get("series") ?? "ELM";
  return NextResponse.json({ number: await peekNextNumber(series) });
}

export const GET = accountingApi(GETHandler)
