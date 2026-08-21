import { accountingApi } from '@/lib/accounting/access'
import { NextResponse } from "next/server";
import { getOutstandingByClient } from "@/lib/accounting/repo";

async function GETHandler() {
  return NextResponse.json(await getOutstandingByClient());
}

export const GET = accountingApi(GETHandler)
