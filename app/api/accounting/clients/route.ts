import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { listClients, createClient } from "@/lib/accounting/repo";

async function GETHandler() {
  return NextResponse.json(await listClients());
}

async function POSTHandler(req: NextRequest) {
  const data = await req.json();
  const id = await createClient(data);
  return NextResponse.json({ id });
}

export const GET = accountingApi(GETHandler)
export const POST = accountingApi(POSTHandler)
