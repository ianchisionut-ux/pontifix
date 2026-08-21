import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { getCompany, updateCompany } from "@/lib/accounting/repo";

async function GETHandler() {
  return NextResponse.json(await getCompany());
}

async function PUTHandler(req: NextRequest) {
  const data = await req.json();
  await updateCompany(data);
  return NextResponse.json(await getCompany());
}

export const GET = accountingApi(GETHandler)
export const PUT = accountingApi(PUTHandler)
