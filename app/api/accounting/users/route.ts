import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { listUsers, createUser } from "@/lib/accounting/repo";

async function GETHandler(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get("all") === "1";
  return NextResponse.json(await listUsers(includeInactive));
}

async function POSTHandler(req: NextRequest) {
  const data = await req.json();
  const id = await createUser(data);
  return NextResponse.json({ id });
}

export const GET = accountingApi(GETHandler)
export const POST = accountingApi(POSTHandler)
